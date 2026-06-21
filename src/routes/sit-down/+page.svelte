<script lang="ts">
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import AssetProjectionDock from '$lib/components/AssetProjectionDock.svelte';
	import AssetProjectionPanel from '$lib/components/AssetProjectionPanel.svelte';
	import LiabilityPaymentCard from '$lib/components/LiabilityPaymentCard.svelte';
	import SitDownReceipt from '$lib/components/SitDownReceipt.svelte';
	import {
		accountIdFromString,
		accountRecordIdFromString,
		createCockpitForm,
		deriveCockpit,
		getCockpitDraftData,
		getCockpitStandUpData,
		hydrateCockpitForm,
		isoTimestampFromString,
		paymentRecordIdFromString,
		sessionIdFromString,
		validateStandUpSession,
		type Account,
		type AppSettings,
		type CockpitAssetForm,
		type CockpitForm,
		type CockpitPaymentForm,
		type PaymentMode,
		type PaymentRecordId
	} from '$lib/domain';
	import {
		createBrowserConfigurationRepository,
		createBrowserSitDownRepository,
		type ConfigurationRepository,
		type SitDownDraftSnapshot,
		type SitDownRepository,
		type StoodUpSitDownSnapshot
	} from '$lib/persistence';

	type ActionState = 'unsaved' | 'saving' | 'saved' | 'invalid' | 'failed';
	type PaymentField =
		| 'sourceAssetAccountId'
		| 'paymentMode'
		| 'startingAccountBalanceText'
		| 'startingStatementBalanceText'
		| 'customPaymentAmountText'
		| 'confirmationId'
		| 'notes';

	const AUTOSAVE_DELAY_MS = 800;

	let configurationRepository = $state<ConfigurationRepository | null>(null);
	let sitDownRepository = $state<SitDownRepository | null>(null);
	let settings = $state<AppSettings | null>(null);
	let accounts = $state<Account[]>([]);
	let form = $state<CockpitForm | null>(null);
	let completedSnapshot = $state<StoodUpSitDownSnapshot | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let actionState = $state<ActionState>('unsaved');
	let actionMessage = $state('Nothing has been saved yet.');
	let standUpAttempted = $state(false);
	let pendingSaves = $state(0);
	let confirmingStandUp = $state(false);
	let startingNew = $state(false);
	let startMessage = $state('');
	let standUpDialog = $state<HTMLDialogElement>();
	let editRevision = 0;
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveChain: Promise<void> = Promise.resolve();

	let derivation = $derived(form && settings ? deriveCockpit(form, accounts, settings) : null);
	let receiptWarnings = $derived(
		completedSnapshot
			? validateStandUpSession({
					session: completedSnapshot.session,
					accounts,
					accountRecords: completedSnapshot.accountRecords,
					paymentRecords: completedSnapshot.paymentRecords.map((payment) => ({
						...payment,
						startingStatementBalance: payment.startingStatementBalance ?? undefined
					}))
				}).warnings
			: []
	);
	let hasRequiredAccounts = $derived(
		form !== null && form.assets.length > 0 && form.payments.length > 0
	);
	let busy = $derived(pendingSaves > 0 || confirmingStandUp || startingNew);

	onMount(() => {
		void loadCockpit();
	});

	onDestroy(() => clearAutosave());

	function localDate(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return year + '-' + month + '-' + day;
	}

	function timestamp() {
		return isoTimestampFromString(new Date().toISOString());
	}

	function randomUuid(): string {
		if (typeof crypto?.randomUUID !== 'function') {
			throw new Error('This browser cannot create stable sit-down IDs.');
		}
		return crypto.randomUUID();
	}

	function newForm(): CockpitForm {
		const now = timestamp();
		return createCockpitForm(accounts, localDate(), now, {
			sessionId: () => sessionIdFromString(randomUuid()),
			accountRecordId: () => accountRecordIdFromString(randomUuid()),
			paymentRecordId: () => paymentRecordIdFromString(randomUuid())
		});
	}

	async function loadCockpit(): Promise<void> {
		clearAutosave();
		loading = true;
		loadError = '';
		try {
			configurationRepository = createBrowserConfigurationRepository();
			sitDownRepository = createBrowserSitDownRepository();
			const configuration = await configurationRepository.loadConfiguration();
			settings = configuration.settings;
			accounts = [...configuration.accounts];
			const latest = await sitDownRepository.loadLatestSession();
			if (latest?.session.isDraft) {
				form = hydrateCockpitForm(latest as SitDownDraftSnapshot, accounts);
				completedSnapshot = null;
				actionState = 'saved';
				actionMessage = 'Saved draft resumed from this browser.';
			} else if (latest) {
				completedSnapshot = latest as StoodUpSitDownSnapshot;
				form = null;
			} else {
				form = newForm();
				completedSnapshot = null;
				actionState = 'unsaved';
				actionMessage = 'New sit-down. Autosave begins after your first valid edit.';
			}
			editRevision = 0;
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'Stashy could not open the sit-down cockpit.';
		} finally {
			loading = false;
		}
	}

	function clearAutosave(): void {
		if (autosaveTimer !== null) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}
	}

	function scheduleAutosave(): void {
		clearAutosave();
		autosaveTimer = setTimeout(() => {
			autosaveTimer = null;
			void queueDraftSave(false);
		}, AUTOSAVE_DELAY_MS);
	}

	function markUnsaved(): void {
		standUpAttempted = false;
		editRevision += 1;
		actionState = 'unsaved';
		actionMessage = 'Unsaved changes. Autosave is waiting for a quiet moment.';
		scheduleAutosave();
	}

	function updateAsset(asset: CockpitAssetForm, value: string): void {
		asset.openingBalanceText = value;
		markUnsaved();
	}

	function updatePayment(paymentId: PaymentRecordId, field: PaymentField, value: string): void {
		if (!form) return;
		const payment = form.payments.find((candidate) => candidate.paymentId === paymentId);
		if (!payment) return;
		switch (field) {
			case 'sourceAssetAccountId':
				payment.sourceAssetAccountId = value ? accountIdFromString(value) : '';
				break;
			case 'paymentMode':
				payment.paymentMode = value as PaymentMode | '';
				break;
			case 'startingAccountBalanceText':
				payment.startingAccountBalanceText = value;
				break;
			case 'startingStatementBalanceText':
				payment.startingStatementBalanceText = value;
				break;
			case 'customPaymentAmountText':
				payment.customPaymentAmountText = value;
				break;
			case 'confirmationId':
				payment.confirmationId = value;
				break;
			case 'notes':
				payment.notes = value;
				break;
		}
		markUnsaved();
	}

	function parsedFieldError(controlId: string): string | undefined {
		return derivation?.fieldErrors.find((error) => error.controlId === controlId)?.message;
	}

	function assetFieldError(asset: CockpitAssetForm): string | undefined {
		const controlId = 'asset-' + asset.accountId + '-openingBalance';
		return (
			parsedFieldError(controlId) ||
			(standUpAttempted && !asset.openingBalanceText.trim()
				? 'Enter an opening balance before standing up.'
				: undefined)
		);
	}

	function paymentFieldError(payment: CockpitPaymentForm, field: string): string | undefined {
		const controlId = 'payment-' + payment.paymentId + '-' + field;
		const parsed = parsedFieldError(controlId);
		if (parsed || !standUpAttempted) return parsed;
		if (field === 'sourceAssetAccountId' && !payment.sourceAssetAccountId) {
			return 'Choose the asset paying this liability.';
		}
		if (field === 'paymentMode' && !payment.paymentMode) {
			return 'Choose a payment mode.';
		}
		if (field === 'startingAccountBalance' && !payment.startingAccountBalanceText.trim()) {
			return 'Enter the account balance.';
		}
		if (
			field === 'startingStatementBalance' &&
			payment.paymentMode === 'statement-balance' &&
			!payment.startingStatementBalanceText.trim()
		) {
			return 'Enter the statement balance.';
		}
		if (
			field === 'customPaymentAmount' &&
			payment.paymentMode === 'custom' &&
			!payment.customPaymentAmountText.trim()
		) {
			return 'Enter the custom payment amount.';
		}
		return undefined;
	}

	function focusControl(controlId: string | null): void {
		if (!controlId) return;
		document.getElementById(controlId)?.focus();
	}

	async function queueDraftSave(manual: boolean): Promise<void> {
		if (!form || !derivation || !sitDownRepository) return;
		clearAutosave();
		const snapshot = getCockpitDraftData(derivation);
		if (!snapshot) {
			actionState = 'invalid';
			actionMessage = manual
				? 'Fix the highlighted date or money input before saving this draft.'
				: 'Autosave paused. Fix the invalid date or money input; the last valid draft is safe.';
			if (manual) focusControl(derivation.firstDraftBlockingControlId);
			return;
		}

		const revision = editRevision;
		actionState = 'saving';
		actionMessage = manual ? 'Saving this draft now…' : 'Autosaving this draft…';
		pendingSaves += 1;
		const operation = saveChain.then(async () => {
			try {
				const saved = await sitDownRepository?.saveDraft(snapshot);
				if (!saved || !form || form.sessionId !== saved.session.id) return;
				form.updatedAt = saved.session.updatedAt;
				if (revision === editRevision) {
					actionState = 'saved';
					actionMessage = manual
						? 'Draft saved in this browser.'
						: 'All changes autosaved in this browser.';
				}
			} catch (error) {
				actionState = 'failed';
				actionMessage =
					error instanceof Error
						? `${error.message} Your current entries are still on screen; retry when ready.`
						: 'The draft could not be saved. Your current entries are still on screen.';
			} finally {
				pendingSaves -= 1;
			}
		});
		saveChain = operation.catch(() => undefined);
		await operation;
	}

	async function saveDraft(): Promise<void> {
		await queueDraftSave(true);
	}

	function requestStandUp(): void {
		if (!derivation || confirmingStandUp) return;
		standUpAttempted = true;
		const snapshot = getCockpitStandUpData(derivation);
		if (!snapshot) {
			actionState = 'failed';
			actionMessage = 'Complete the highlighted payment details before standing up.';
			focusControl(derivation.firstStandUpBlockingControlId);
			return;
		}
		clearAutosave();
		standUpDialog?.showModal();
	}

	async function confirmStandUp(): Promise<void> {
		if (!derivation || !sitDownRepository || confirmingStandUp) return;
		const snapshot = getCockpitStandUpData(derivation);
		if (!snapshot) {
			standUpDialog?.close();
			requestStandUp();
			return;
		}
		confirmingStandUp = true;
		actionState = 'saving';
		actionMessage = 'Saving the completed snapshot…';
		try {
			await saveChain;
			const saved = await sitDownRepository.standUp(snapshot);
			completedSnapshot = saved;
			form = null;
			standUpDialog?.close();
		} catch (error) {
			standUpDialog?.close();
			actionState = 'failed';
			actionMessage =
				error instanceof Error
					? `${error.message} The sit-down was not stood up; your entries remain available.`
					: 'The sit-down was not stood up. Your entries remain available.';
		} finally {
			confirmingStandUp = false;
		}
	}

	async function startNewSitDown(): Promise<void> {
		if (!settings || !sitDownRepository || startingNew) return;
		startingNew = true;
		startMessage = '';
		try {
			const fresh = newForm();
			const snapshot = getCockpitDraftData(deriveCockpit(fresh, accounts, settings));
			if (!snapshot) throw new Error('Stashy could not prepare a new draft.');
			const saved = await sitDownRepository.saveDraft(snapshot);
			form = hydrateCockpitForm(saved, accounts);
			completedSnapshot = null;
			editRevision = 0;
			actionState = 'saved';
			actionMessage = 'New blank draft saved in this browser.';
			standUpAttempted = false;
		} catch (error) {
			startMessage =
				error instanceof Error ? error.message : 'A new sit-down could not be started.';
		} finally {
			startingNew = false;
		}
	}
</script>

<svelte:head><title>Sit Down - Stashy</title></svelte:head>

<section class="page-intro cockpit-intro">
	<div>
		<p class="eyebrow">Payment cockpit</p>
		<h1>Sit Down</h1>
		<p>Update the truth, plan each payment, and keep the source balances in sight.</p>
	</div>
	{#if form}
		<label class="sit-down-date" for="sit-down-date">
			<span>Sit-down date</span>
			<input
				id="sit-down-date"
				type="date"
				value={form.sitDownDateText}
				aria-invalid={parsedFieldError('sit-down-date') ? 'true' : undefined}
				oninput={(event) => {
					if (form) form.sitDownDateText = event.currentTarget.value;
					markUnsaved();
				}}
			/>
			{#if parsedFieldError('sit-down-date')}
				<small class="field-error">{parsedFieldError('sit-down-date')}</small>
			{/if}
		</label>
	{/if}
</section>

{#if loading}
	<section class="panel loading-panel" aria-live="polite">
		<h2>Opening your cockpit…</h2>
		<p>Stashy is loading account configuration and your latest sit-down.</p>
	</section>
{:else if loadError}
	<section class="panel error-panel" role="alert">
		<h2>The cockpit could not open.</h2>
		<p>{loadError}</p>
		<button class="button secondary" type="button" onclick={loadCockpit}>Try again</button>
	</section>
{:else if completedSnapshot}
	<SitDownReceipt
		snapshot={completedSnapshot}
		{accounts}
		warnings={receiptWarnings}
		{startingNew}
		{startMessage}
		onStartNew={startNewSitDown}
	/>
{:else if !hasRequiredAccounts}
	<section class="panel first-run cockpit-setup">
		<p class="eyebrow">Account setup</p>
		<h2>The cockpit needs a source and something to pay.</h2>
		<p>
			Add at least one active asset and one active liability. Their configured order becomes the
			flow of every new sit-down.
		</p>
		<a class="button primary" href={resolve('/configuration/accounts/')}>Configure accounts</a>
	</section>
{:else if form && derivation}
	<div class="cockpit-layout">
		<aside class="asset-rail" aria-labelledby="source-assets-title">
			<div class="rail-heading">
				<p class="eyebrow">Always in view</p>
				<h2 id="source-assets-title">Source assets</h2>
				<p>Every complete payment hits its selected source immediately.</p>
			</div>
			<div class="asset-projection-list">
				{#each form.assets as asset (asset.accountId)}
					{@const account = accounts.find((candidate) => candidate.id === asset.accountId)}
					{@const view = derivation.assets.find(
						(candidate) => candidate.accountId === asset.accountId
					)}
					{#if account?.type === 'asset' && view}
						<AssetProjectionPanel
							{account}
							form={asset}
							{view}
							fieldError={assetFieldError(asset)}
							onInput={(value) => updateAsset(asset, value)}
						/>
					{/if}
				{/each}
			</div>
		</aside>

		<AssetProjectionDock
			assets={form.assets.flatMap((asset) => {
				const account = accounts.find((candidate) => candidate.id === asset.accountId);
				const view = derivation.assets.find((candidate) => candidate.accountId === asset.accountId);
				return account?.type === 'asset' && view ? [{ account, view }] : [];
			})}
		/>

		<section class="liability-stack" aria-labelledby="payments-title">
			<div class="stack-heading">
				<div>
					<p class="eyebrow">One focused decision at a time</p>
					<h2 id="payments-title">Liability payments</h2>
				</div>
				<span class="count-badge">{form.payments.length}</span>
			</div>
			{#each form.payments as payment (payment.paymentId)}
				{@const account = accounts.find((candidate) => candidate.id === payment.liabilityAccountId)}
				{@const view = derivation.payments.find(
					(candidate) => candidate.paymentId === payment.paymentId
				)}
				{#if account?.type === 'liability' && view}
					<LiabilityPaymentCard
						{account}
						sourceAssets={form.assets
							.map((asset) => accounts.find((candidate) => candidate.id === asset.accountId))
							.filter((candidate) => candidate?.type === 'asset')}
						form={payment}
						{view}
						fieldError={(field) => paymentFieldError(payment, field)}
						onChange={(field, value) => updatePayment(payment.paymentId, field, value)}
					/>
				{/if}
			{/each}
		</section>
	</div>

	<section class="cockpit-actions panel" aria-label="Sit-down actions">
		<div class="save-state {actionState}" role="status" aria-live="polite">
			<strong>
				{actionState === 'saving'
					? 'Saving'
					: actionState === 'saved'
						? 'Draft saved'
						: actionState === 'invalid'
							? 'Autosave paused'
							: actionState === 'failed'
								? 'Needs attention'
								: 'Unsaved'}
			</strong>
			<span>{actionMessage}</span>
		</div>
		<div class="cockpit-action-buttons">
			<button class="button secondary" type="button" disabled={busy} onclick={saveDraft}>
				{pendingSaves > 0 ? 'Saving…' : 'Save Draft'}
			</button>
			<button
				class="button primary"
				type="button"
				disabled={confirmingStandUp}
				onclick={requestStandUp}
			>
				Stand Up
			</button>
		</div>
	</section>
{/if}

<dialog
	class="stand-up-dialog"
	aria-labelledby="stand-up-title"
	bind:this={standUpDialog}
	oncancel={() => (confirmingStandUp = false)}
>
	<form method="dialog" class="stand-up-dialog-content">
		<p class="eyebrow">Commit this snapshot</p>
		<h2 id="stand-up-title">Ready to stand up?</h2>
		<p>
			Stashy will save these opening balances, final balances, and payment decisions as a completed
			session. Completed-session editing arrives with Archive in Phase 5.
		</p>
		<div class="dialog-actions">
			<button class="button secondary" type="submit" disabled={confirmingStandUp}
				>Keep Sitting</button
			>
			<button
				class="button primary"
				type="button"
				disabled={confirmingStandUp}
				onclick={confirmStandUp}
			>
				{confirmingStandUp ? 'Standing Up…' : 'Confirm Stand Up'}
			</button>
		</div>
	</form>
</dialog>
