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
	};

	let { account, sourceAssets, form, view, fieldError, onChange }: Props = $props();
	let financialIssues = $derived(
		view.issues.filter((issue) =>
			[
				'negative-payment',
				'payment-exceeds-account-balance',
				'negative-remaining-account-balance',
				'negative-remaining-statement-balance'
			].includes(issue.code)
		)
	);
</script>

<article class="liability-card" aria-labelledby="liability-{account.id}-title">
	<header class="liability-card-heading">
		<div>
			<p class="card-step">Payment plan</p>
			<h2 id="liability-{account.id}-title">{account.name}</h2>
		</div>
		{#if view.resolvedPayment}
			<span class="plan-ready">Calculated</span>
		{:else}
			<span class="plan-pending">Needs details</span>
		{/if}
	</header>

	<div class="liability-balance-grid">
		<label for="payment-{form.paymentId}-startingAccountBalance">
			<span>Account balance</span>
			<input
				id="payment-{form.paymentId}-startingAccountBalance"
				type="text"
				inputmode="decimal"
				value={form.startingAccountBalanceText}
				aria-invalid={fieldError('startingAccountBalance') ? 'true' : undefined}
				oninput={(event) => onChange('startingAccountBalanceText', event.currentTarget.value)}
			/>
			{#if fieldError('startingAccountBalance')}
				<small class="field-error">{fieldError('startingAccountBalance')}</small>
			{/if}
		</label>
		<label for="payment-{form.paymentId}-startingStatementBalance">
			<span>Statement balance</span>
			<input
				id="payment-{form.paymentId}-startingStatementBalance"
				type="text"
				inputmode="decimal"
				value={form.startingStatementBalanceText}
				aria-invalid={fieldError('startingStatementBalance') ? 'true' : undefined}
				oninput={(event) => onChange('startingStatementBalanceText', event.currentTarget.value)}
			/>
			{#if fieldError('startingStatementBalance')}
				<small class="field-error">{fieldError('startingStatementBalance')}</small>
			{/if}
		</label>
	</div>

	<div class="payment-decision-grid">
		<label for="payment-{form.paymentId}-sourceAssetAccountId">
			<span>Pay from</span>
			<select
				id="payment-{form.paymentId}-sourceAssetAccountId"
				value={form.sourceAssetAccountId}
				aria-invalid={fieldError('sourceAssetAccountId') ? 'true' : undefined}
				onchange={(event) => onChange('sourceAssetAccountId', event.currentTarget.value)}
			>
				<option value="">Choose a source asset</option>
				{#each sourceAssets as asset (asset.id)}
					<option value={asset.id}>{asset.name}</option>
				{/each}
			</select>
			{#if fieldError('sourceAssetAccountId')}
				<small class="field-error">{fieldError('sourceAssetAccountId')}</small>
			{/if}
		</label>

		<fieldset id="payment-{form.paymentId}-paymentMode" tabindex="-1">
			<legend>Payment mode</legend>
			<div class="mode-choices">
				<label class:active={form.paymentMode === 'full-balance'}>
					<input
						type="radio"
						name="payment-mode-{form.paymentId}"
						value="full-balance"
						checked={form.paymentMode === 'full-balance'}
						onchange={() => onChange('paymentMode', 'full-balance')}
					/>
					<span>Full balance</span>
				</label>
				<label class:active={form.paymentMode === 'statement-balance'}>
					<input
						type="radio"
						name="payment-mode-{form.paymentId}"
						value="statement-balance"
						checked={form.paymentMode === 'statement-balance'}
						onchange={() => onChange('paymentMode', 'statement-balance')}
					/>
					<span>Statement</span>
				</label>
				<label class:active={form.paymentMode === 'custom'}>
					<input
						type="radio"
						name="payment-mode-{form.paymentId}"
						value="custom"
						checked={form.paymentMode === 'custom'}
						onchange={() => onChange('paymentMode', 'custom')}
					/>
					<span>Custom</span>
				</label>
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
					oninput={(event) => onChange('customPaymentAmountText', event.currentTarget.value)}
				/>
				{#if fieldError('customPaymentAmount')}
					<small class="field-error">{fieldError('customPaymentAmount')}</small>
				{/if}
			</label>
		{:else}
			<div class="calculated-field">
				<span>Payment amount</span>
				<strong>{view.paymentAmountDisplay}</strong>
				<small>{form.paymentMode ? 'Set by payment mode' : 'Choose a payment mode'}</small>
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
