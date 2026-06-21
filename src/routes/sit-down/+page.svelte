<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import AssetProjectionPanel from '$lib/components/AssetProjectionPanel.svelte';
	import LiabilityPaymentCard from '$lib/components/LiabilityPaymentCard.svelte';
	import {
		accountIdFromString,
		accountRecordIdFromString,
		createCockpitForm,
		deriveCockpit,
		getCockpitDraftData,
		hydrateCockpitForm,
		isoTimestampFromString,
		paymentRecordIdFromString,
		sessionIdFromString,
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
		createBrowserSitDownDraftRepository,
		type ConfigurationRepository,
		type SitDownDraftRepository
	} from '$lib/persistence';

	type ActionState = 'unsaved' | 'saving' | 'saved' | 'failed' | 'ready';
	type PaymentField =
		| 'sourceAssetAccountId'
		| 'paymentMode'
		| 'startingAccountBalanceText'
		| 'startingStatementBalanceText'
		| 'customPaymentAmountText'
		| 'confirmationId'
		| 'notes';

	let configurationRepository = $state<ConfigurationRepository | null>(null);
	let draftRepository = $state<SitDownDraftRepository | null>(null);
	let settings = $state<AppSettings | null>(null);
	let accounts = $state<Account[]>([]);
	let form = $state<CockpitForm | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let actionState = $state<ActionState>('unsaved');
	let actionMessage = $state('Nothing has been saved yet.');
	let standUpAttempted = $state(false);
	let derivation = $derived(form && settings ? deriveCockpit(form, accounts, settings) : null);
	let hasRequiredAccounts = $derived(
		form !== null && form.assets.length > 0 && form.payments.length > 0
	);
	let busy = $derived(actionState === 'saving');

	onMount(() => {
		void loadCockpit();
	});

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
		loading = true;
		loadError = '';
		try {
			configurationRepository = createBrowserConfigurationRepository();
			draftRepository = createBrowserSitDownDraftRepository();
			const configuration = await configurationRepository.loadConfiguration();
			settings = configuration.settings;
			accounts = [...configuration.accounts];
			const savedDraft = await draftRepository.loadLatestDraft();
			if (savedDraft) {
				form = hydrateCockpitForm(savedDraft, accounts);
				actionState = 'saved';
				actionMessage = 'Saved draft resumed from this browser.';
			} else {
				form = newForm();
				actionState = 'unsaved';
				actionMessage = 'New sit-down. Nothing has been saved yet.';
			}
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'Stashy could not open the sit-down cockpit.';
		} finally {
			loading = false;
		}
	}

	function markUnsaved(): void {
		standUpAttempted = false;
		actionState = 'unsaved';
		actionMessage = 'Unsaved changes.';
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
		if (field === 'startingStatementBalance' && !payment.startingStatementBalanceText.trim()) {
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

	async function saveDraft(): Promise<void> {
		if (!form || !derivation || !draftRepository || busy) return;
		const draft = getCockpitDraftData(derivation);
		if (!draft) {
			actionState = 'failed';
			actionMessage = 'Fix the highlighted date or money input before saving this draft.';
			focusControl(derivation.firstDraftBlockingControlId);
			return;
		}
		actionState = 'saving';
		actionMessage = 'Saving this draft to this browser…';
		try {
			const saved = await draftRepository.saveDraft(draft);
			form.updatedAt = saved.session.updatedAt;
			actionState = 'saved';
			actionMessage = 'Draft saved in this browser.';
		} catch (error) {
			actionState = 'failed';
			actionMessage = error instanceof Error ? error.message : 'The draft could not be saved.';
		}
	}

	function standUp(): void {
		if (!derivation || busy) return;
		standUpAttempted = true;
		if (!derivation.standUpValidation?.isValid || derivation.firstStandUpBlockingControlId) {
			actionState = 'failed';
			actionMessage = 'Complete the highlighted payment details before standing up.';
			focusControl(derivation.firstStandUpBlockingControlId);
			return;
		}
		actionState = 'ready';
		actionMessage =
			'This sit-down is complete and ready to stand up. Phase 4 will save the final state; this remains a draft for now.';
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
		<p>Stashy is loading account configuration and any saved draft.</p>
	</section>
{:else if loadError}
	<section class="panel error-panel" role="alert">
		<h2>The cockpit could not open.</h2>
		<p>{loadError}</p>
		<button class="button secondary" type="button" onclick={loadCockpit}>Try again</button>
	</section>
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
						: actionState === 'ready'
							? 'Ready to stand up'
							: actionState === 'failed'
								? 'Needs attention'
								: 'Unsaved'}
			</strong>
			<span>{actionMessage}</span>
		</div>
		<div class="cockpit-action-buttons">
			<button class="button secondary" type="button" disabled={busy} onclick={saveDraft}>
				{busy ? 'Saving…' : 'Save Draft'}
			</button>
			<button class="button primary" type="button" disabled={busy} onclick={standUp}>
				Stand Up
			</button>
		</div>
	</section>
{/if}
