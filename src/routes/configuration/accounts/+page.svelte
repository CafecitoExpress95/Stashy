<script lang="ts">
	import { onMount } from 'svelte';
	import AccountEditor from '$lib/components/AccountEditor.svelte';
	import AccountList from '$lib/components/AccountList.svelte';
	import ThresholdDefaultsForm from '$lib/components/ThresholdDefaultsForm.svelte';
	import {
		selectActiveAccounts,
		selectArchivedAccounts,
		type Account,
		type AccountMoveDirection,
		type AppSettings,
		type AssetThresholdPolicy,
		type AssetThresholds
	} from '$lib/domain';
	import {
		ConfigurationRepositoryError,
		createBrowserConfigurationRepository,
		type ConfigurationRepository
	} from '$lib/persistence';

	type SaveResult =
		| { readonly ok: true }
		| { readonly ok: false; readonly message: string; readonly field?: string };

	type AccountFormValue = {
		readonly type: 'asset' | 'liability';
		readonly name: string;
		readonly thresholdPolicy?: AssetThresholdPolicy;
	};

	let repository = $state<ConfigurationRepository | null>(null);
	let settings = $state<AppSettings | null>(null);
	let accounts = $state<Account[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let actionMessage = $state('');
	let editorMode = $state<'closed' | 'create' | 'edit'>('closed');
	let editingAccount = $state<Account | null>(null);
	let editorKey = $derived(
		editorMode === 'create' ? 'create' : editorMode === 'edit' ? editingAccount?.id : 'closed'
	);
	let activeAssets = $derived(selectActiveAccounts(accounts, 'asset'));
	let activeLiabilities = $derived(selectActiveAccounts(accounts, 'liability'));
	let archivedAccounts = $derived(selectArchivedAccounts(accounts));

	onMount(() => {
		try {
			repository = createBrowserConfigurationRepository();
			void reloadConfiguration(true);
		} catch (error) {
			loading = false;
			loadError = errorMessage(error);
		}
	});

	function errorMessage(error: unknown): string {
		return error instanceof ConfigurationRepositoryError
			? error.message
			: error instanceof Error
				? error.message
				: 'Stashy could not update local configuration.';
	}

	function resultFromError(error: unknown): SaveResult {
		return {
			ok: false,
			message: errorMessage(error),
			field: error instanceof ConfigurationRepositoryError ? error.field : undefined
		};
	}

	async function reloadConfiguration(showLoading = false): Promise<void> {
		if (!repository) return;
		if (showLoading) loading = true;
		loadError = '';
		try {
			const snapshot = await repository.loadConfiguration();
			settings = snapshot.settings;
			accounts = [...snapshot.accounts];
		} catch (error) {
			loadError = errorMessage(error);
		} finally {
			loading = false;
		}
	}

	function createAccount(): void {
		editingAccount = null;
		editorMode = 'create';
		actionMessage = '';
	}

	function editAccount(account: Account): void {
		editingAccount = account;
		editorMode = 'edit';
		actionMessage = '';
	}

	function closeEditor(): void {
		editorMode = 'closed';
		editingAccount = null;
	}

	async function saveAccount(value: AccountFormValue): Promise<SaveResult> {
		if (!repository) return { ok: false, message: 'Local storage is not ready yet.' };
		try {
			if (editorMode === 'edit' && editingAccount) {
				await repository.updateAccount(editingAccount.id, {
					name: value.name,
					thresholdPolicy: editingAccount.type === 'asset' ? value.thresholdPolicy : undefined
				});
				actionMessage = `${value.name.trim()} updated.`;
			} else if (value.type === 'asset') {
				await repository.createAccount({
					type: 'asset',
					name: value.name,
					thresholdPolicy: value.thresholdPolicy ?? { mode: 'inherit' }
				});
				actionMessage = `${value.name.trim()} added.`;
			} else {
				await repository.createAccount({ type: 'liability', name: value.name });
				actionMessage = `${value.name.trim()} added.`;
			}
			await reloadConfiguration();
			closeEditor();
			return { ok: true };
		} catch (error) {
			return resultFromError(error);
		}
	}

	async function saveDefaults(value: AssetThresholds | null): Promise<SaveResult> {
		if (!repository) return { ok: false, message: 'Local storage is not ready yet.' };
		try {
			settings = await repository.updateDefaultAssetThresholds(value);
			return { ok: true };
		} catch (error) {
			return resultFromError(error);
		}
	}

	async function moveAccount(account: Account, direction: AccountMoveDirection): Promise<void> {
		if (!repository) return;
		try {
			accounts = [...(await repository.moveAccount(account.id, direction))];
			actionMessage = `${account.name} moved ${direction}.`;
		} catch (error) {
			actionMessage = errorMessage(error);
		}
	}

	async function archiveAccount(account: Account): Promise<void> {
		if (!repository) return;
		try {
			const updated = await repository.setAccountArchived(account.id, true);
			accounts = accounts.map((candidate) => (candidate.id === updated.id ? updated : candidate));
			if (editingAccount?.id === updated.id) closeEditor();
			actionMessage = `${account.name} archived. It remains available to history.`;
		} catch (error) {
			actionMessage = errorMessage(error);
		}
	}

	async function unarchiveAccount(account: Account): Promise<void> {
		if (!repository) return;
		try {
			const updated = await repository.setAccountArchived(account.id, false);
			accounts = accounts.map((candidate) => (candidate.id === updated.id ? updated : candidate));
			actionMessage = `${account.name} restored to active accounts.`;
		} catch (error) {
			actionMessage = errorMessage(error);
		}
	}
</script>

<svelte:head><title>Accounts - Stashy</title></svelte:head>

<section class="page-intro">
	<div>
		<p class="eyebrow">Configuration</p>
		<h1>Accounts</h1>
		<p>
			Set the asset and liability rows your sit-down will use. Archived accounts stay resolvable for
			history but disappear from new work.
		</p>
	</div>
	<button class="button primary" type="button" onclick={createAccount}>Add account</button>
</section>

{#if actionMessage}
	<p class="form-message success" role="status">{actionMessage}</p>
{/if}

{#if loading}
	<section class="panel loading-panel" aria-live="polite">
		<h2>Opening your local configuration...</h2>
		<p>Stashy is reading this browser's IndexedDB.</p>
	</section>
{:else if loadError}
	<section class="panel error-panel" role="alert">
		<h2>Configuration could not be opened.</h2>
		<p>{loadError}</p>
		<button class="button secondary" type="button" onclick={() => reloadConfiguration(true)}>
			Try again
		</button>
	</section>
{:else if settings}
	{#if accounts.length === 0}
		<section class="panel first-run">
			<p class="eyebrow">First setup</p>
			<h2>Start with the accounts you actually touch during a sit-down.</h2>
			<p>
				Add the checking or savings accounts that fund payments, then each card or liability you
				pay. You can change names and order later without breaking saved references.
			</p>
			<button class="button primary" type="button" onclick={createAccount}
				>Add your first account</button
			>
		</section>
	{/if}

	<div class="configuration-layout" style="margin-top: 20px">
		<div class="configuration-main">
			<AccountList
				title="Assets"
				description="Balances that can fund planned payments."
				accounts={activeAssets}
				onEdit={editAccount}
				onMove={moveAccount}
				onArchive={archiveAccount}
			/>
			<AccountList
				title="Liabilities"
				description="Accounts whose balances you pay down."
				accounts={activeLiabilities}
				onEdit={editAccount}
				onMove={moveAccount}
				onArchive={archiveAccount}
			/>

			{#if archivedAccounts.length > 0}
				<section class="panel archived-section" aria-labelledby="archived-title">
					<div class="section-heading">
						<div>
							<h2 id="archived-title">Archived accounts</h2>
							<p>Hidden from new sit-downs and retained for historical records.</p>
						</div>
						<span class="count-badge">{archivedAccounts.length}</span>
					</div>
					<ul class="archived-list">
						{#each archivedAccounts as account (account.id)}
							<li>
								<span><strong>{account.name}</strong> <small>({account.type})</small></span>
								<button
									class="button secondary compact"
									type="button"
									onclick={() => unarchiveAccount(account)}>Unarchive</button
								>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>

		<aside class="configuration-sidebar" aria-label="Account settings">
			<ThresholdDefaultsForm thresholds={settings.defaultAssetThresholds} onSave={saveDefaults} />

			{#if editorMode !== 'closed'}
				{#key editorKey}
					<AccountEditor
						account={editingAccount}
						defaultsEnabled={settings.defaultAssetThresholds !== null}
						onSave={saveAccount}
						onCancel={closeEditor}
					/>
				{/key}
			{:else}
				<section class="panel editor">
					<p class="eyebrow">Account editor</p>
					<h2>Add or select an account</h2>
					<p>
						Account type stays fixed after creation. Rename, reorder, or archive whenever needed.
					</p>
					<button class="button primary" type="button" onclick={createAccount}>Add account</button>
				</section>
			{/if}
		</aside>
	</div>
{/if}
