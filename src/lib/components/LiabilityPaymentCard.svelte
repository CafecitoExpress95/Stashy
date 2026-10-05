<script lang="ts">
	import type {
		AssetAccount,
		CockpitPaymentForm,
		CockpitPaymentView,
		LiabilityAccount
	} from '$lib/domain';

	type EditableField =
		| 'sourceAssetAccountId'
		| 'paymentMode'
		| 'startingAccountBalanceText'
		| 'startingStatementBalanceText'
		| 'customPaymentAmountText'
		| 'confirmationId'
		| 'notes';

	type Props = {
		account: LiabilityAccount;
		sourceAssets: readonly AssetAccount[];
		form: CockpitPaymentForm;
		view: CockpitPaymentView;
		fieldError: (field: string) => string | undefined;
		onChange: (field: EditableField, value: string) => void;
		onFocus: (controlId: string) => void;
	};

	let { account, sourceAssets, form, view, fieldError, onChange, onFocus }: Props = $props();
	let isNoPayment = $derived(form.paymentMode === 'no-payment');
	let needsSource = $derived(!isNoPayment && !form.sourceAssetAccountId);
	let financialIssues = $derived(
		view.issues.filter((issue) =>
			[
				'negative-payment',
				'payment-exceeds-account-balance',
				'negative-remaining-account-balance'
			].includes(issue.code)
		)
	);

	function togglePaymentMode(mode: 'full-balance' | 'statement-balance' | 'custom'): void {
		onChange('paymentMode', form.paymentMode === mode ? 'no-payment' : mode);
	}
</script>

<article class="liability-card" aria-labelledby="liability-{account.id}-title">
	<header class="liability-card-heading">
		<div>
			<p class="card-step">Payment plan</p>
			<h2 id="liability-{account.id}-title">{account.name}</h2>
		</div>
		{#if view.issues.some((issue) => issue.severity === 'error')}
			<span class="plan-pending">Record error</span>
		{:else if view.hasInvalidInput}
			<span class="plan-pending">Fix input</span>
		{:else if view.projectionExclusion}
			<span class="plan-pending">Payment excluded</span>
		{:else if view.resolvedPayment}
			<span class="plan-ready">Calculated</span>
		{:else}
			<span class="plan-pending">Needs details</span>
		{/if}
	</header>

	{#if needsSource}
		<div class="projection-warning">
			<p id="payment-{form.paymentId}-sourceAssetAccountId-warning">
				Choose a source — this payment is excluded from running balances.
			</p>
			<button
				type="button"
				class="button secondary"
				onclick={() => onFocus(`payment-${form.paymentId}-sourceAssetAccountId`)}
				>Choose source</button
			>
		</div>
	{:else if view.projectionExclusion}
		<div class="projection-warning" id="payment-{form.paymentId}-exclusion">
			<p>Payment excluded from running balances.</p>
			<ul>
				{#each view.projectionExclusion.issues as issue (issue.code)}<li>{issue.message}</li>{/each}
			</ul>
		</div>
	{/if}

	<div class="liability-balance-grid">
		<label for="payment-{form.paymentId}-startingAccountBalance">
			<span>Account balance</span>
			<input
				id="payment-{form.paymentId}-startingAccountBalance"
				type="text"
				inputmode="decimal"
				value={form.startingAccountBalanceText}
				aria-invalid={fieldError('startingAccountBalance') ? 'true' : undefined}
				aria-describedby={fieldError('startingAccountBalance')
					? `payment-${form.paymentId}-startingAccountBalance-error`
					: undefined}
				oninput={(event) => onChange('startingAccountBalanceText', event.currentTarget.value)}
			/>
			{#if fieldError('startingAccountBalance')}
				<small class="field-error" id="payment-{form.paymentId}-startingAccountBalance-error"
					>{fieldError('startingAccountBalance')}</small
				>
			{/if}
		</label>
		<label for="payment-{form.paymentId}-startingStatementBalance">
			<span>Statement balance <small>optional</small></span>
			<input
				id="payment-{form.paymentId}-startingStatementBalance"
				type="text"
				inputmode="decimal"
				value={form.startingStatementBalanceText}
				aria-invalid={fieldError('startingStatementBalance') ? 'true' : undefined}
				aria-describedby={`payment-${form.paymentId}-startingStatementBalance-help`}
				oninput={(event) => onChange('startingStatementBalanceText', event.currentTarget.value)}
			/>
			{#if fieldError('startingStatementBalance')}
				<small class="field-error" id="payment-{form.paymentId}-startingStatementBalance-help"
					>{fieldError('startingStatementBalance')}</small
				>
			{:else}
				<small id="payment-{form.paymentId}-startingStatementBalance-help"
					>Required only when using Statement payment mode.</small
				>
			{/if}
		</label>
	</div>

	<div class="payment-decision-grid">
		<label for="payment-{form.paymentId}-sourceAssetAccountId">
			<span>{isNoPayment ? 'No source needed' : 'Pay from'}</span>
			<select
				id="payment-{form.paymentId}-sourceAssetAccountId"
				value={isNoPayment ? '' : form.sourceAssetAccountId}
				disabled={isNoPayment}
				aria-invalid={needsSource || (!isNoPayment && fieldError('sourceAssetAccountId'))
					? 'true'
					: undefined}
				aria-describedby={needsSource
					? `payment-${form.paymentId}-sourceAssetAccountId-warning`
					: view.projectionExclusion
						? `payment-${form.paymentId}-exclusion`
						: isNoPayment
							? `payment-${form.paymentId}-sourceAssetAccountId-help`
							: undefined}
				onchange={(event) => onChange('sourceAssetAccountId', event.currentTarget.value)}
			>
				<option value="">{isNoPayment ? 'No source — not paying' : 'Choose a source asset'}</option>
				{#each sourceAssets as asset (asset.id)}
					<option value={asset.id}>{asset.name}</option>
				{/each}
			</select>
			{#if !needsSource && !isNoPayment && fieldError('sourceAssetAccountId')}
				<small class="field-error">{fieldError('sourceAssetAccountId')}</small>
			{:else if isNoPayment}
				<small id="payment-{form.paymentId}-sourceAssetAccountId-help"
					>No money will leave a source asset for this liability.</small
				>
			{/if}
		</label>

		<fieldset
			id="payment-{form.paymentId}-paymentMode"
			tabindex="-1"
			aria-describedby="payment-{form.paymentId}-paymentModeHelp"
		>
			<legend>Payment mode</legend>
			<p id="payment-{form.paymentId}-paymentModeHelp" class="mode-helper">
				{isNoPayment
					? 'No payment is assumed. Choose a paid mode only if money will leave an asset.'
					: 'Press the active paid mode again to return to No payment.'}
			</p>
			<div class="mode-choices">
				<button
					type="button"
					class:active={form.paymentMode === 'full-balance'}
					aria-pressed={form.paymentMode === 'full-balance'}
					onclick={() => togglePaymentMode('full-balance')}
				>
					Full balance
				</button>
				<button
					type="button"
					class:active={form.paymentMode === 'statement-balance'}
					aria-pressed={form.paymentMode === 'statement-balance'}
					onclick={() => togglePaymentMode('statement-balance')}
				>
					Statement
				</button>
				<button
					type="button"
					class:active={form.paymentMode === 'custom'}
					aria-pressed={form.paymentMode === 'custom'}
					onclick={() => togglePaymentMode('custom')}
				>
					Custom
				</button>
			</div>
			{#if fieldError('paymentMode')}
				<small class="field-error">{fieldError('paymentMode')}</small>
			{/if}
		</fieldset>
	</div>

	<div class="payment-result-grid">
		{#if form.paymentMode === 'custom'}
			<label for="payment-{form.paymentId}-customPaymentAmount">
				<span>Payment amount</span>
				<input
					id="payment-{form.paymentId}-customPaymentAmount"
					type="text"
					inputmode="decimal"
					value={form.customPaymentAmountText}
					aria-invalid={fieldError('customPaymentAmount') ? 'true' : undefined}
					aria-describedby={fieldError('customPaymentAmount')
						? `payment-${form.paymentId}-customPaymentAmount-error`
						: undefined}
					oninput={(event) => onChange('customPaymentAmountText', event.currentTarget.value)}
				/>
				{#if fieldError('customPaymentAmount')}
					<small class="field-error" id="payment-{form.paymentId}-customPaymentAmount-error"
						>{fieldError('customPaymentAmount')}</small
					>
				{/if}
			</label>
		{:else}
			<div class="calculated-field">
				<span>Payment amount</span>
				<strong>{view.paymentAmountDisplay}</strong>
				<small>
					{form.paymentMode === 'no-payment' ? 'No money leaves an asset' : 'Set by payment mode'}
				</small>
			</div>
		{/if}
		<div class="calculated-field remaining-account">
			<span>Remaining account</span>
			<strong>{view.remainingAccountBalanceDisplay}</strong>
		</div>
		<div class="calculated-field remaining-statement">
			<span>Remaining statement</span>
			<strong>{view.remainingStatementBalanceDisplay}</strong>
		</div>
	</div>

	{#if financialIssues.length > 0}
		<ul class="payment-warnings" aria-label="Payment warnings">
			{#each financialIssues as issue (issue.code)}
				<li>{issue.message}</li>
			{/each}
		</ul>
	{/if}

	<div class="payment-notes-grid">
		<label for="payment-{form.paymentId}-confirmationId">
			<span>Confirmation ID <small>optional</small></span>
			<input
				id="payment-{form.paymentId}-confirmationId"
				type="text"
				value={form.confirmationId}
				oninput={(event) => onChange('confirmationId', event.currentTarget.value)}
			/>
		</label>
		<label for="payment-{form.paymentId}-notes">
			<span>Notes <small>optional</small></span>
			<textarea
				id="payment-{form.paymentId}-notes"
				rows="2"
				value={form.notes}
				oninput={(event) => onChange('notes', event.currentTarget.value)}></textarea>
		</label>
	</div>
</article>
