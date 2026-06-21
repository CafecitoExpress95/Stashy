<script lang="ts">
	import type { AssetAccount, CockpitAssetForm, CockpitAssetView } from '$lib/domain';

	type Props = {
		account: AssetAccount;
		form: CockpitAssetForm;
		view: CockpitAssetView;
		fieldError?: string;
		onInput: (value: string) => void;
	};

	let { account, form, view, fieldError, onInput }: Props = $props();

	let visualState = $derived(
		view.safetyState === 'negative'
			? 'negative'
			: view.safetyState === 'zero'
				? 'zero'
				: view.thresholdState
	);
	let statusLabel = $derived(
		view.safetyState === 'negative'
			? 'Below zero'
			: view.safetyState === 'zero'
				? 'At zero'
				: view.thresholdState === 'none'
					? 'No thresholds'
					: view.thresholdState[0].toUpperCase() + view.thresholdState.slice(1)
	);
</script>

<article class="asset-projection {visualState}" aria-labelledby="asset-{account.id}-title">
	<div class="asset-projection-heading">
		<div>
			<p class="asset-kicker">Source asset</p>
			<h3 id="asset-{account.id}-title">{account.name}</h3>
		</div>
		<span class="balance-status">{statusLabel}</span>
	</div>

	<label for="asset-{account.id}-openingBalance">
		<span>Opening balance</span>
		<input
			id="asset-{account.id}-openingBalance"
			type="text"
			inputmode="decimal"
			value={form.openingBalanceText}
			aria-invalid={fieldError ? 'true' : undefined}
			aria-describedby={fieldError ? 'asset-' + account.id + '-error' : undefined}
			oninput={(event) => onInput(event.currentTarget.value)}
		/>
	</label>
	{#if fieldError}
		<p class="field-error" id="asset-{account.id}-error">{fieldError}</p>
	{/if}

	<div class="projected-balance" aria-live="polite">
		<span>Projected after planned payments</span>
		<strong>{view.projectedDisplay}</strong>
	</div>

	{#if view.safetyState !== 'normal'}
		<div class="safety-alert" role="alert">
			<strong>{view.safetyState === 'negative' ? 'Overdraft risk' : 'No cushion remains'}</strong>
			<span>
				{view.safetyState === 'negative'
					? 'Planned payments put this asset below $0.00.'
					: 'Planned payments leave this asset at exactly $0.00.'}
			</span>
		</div>
	{/if}
</article>
