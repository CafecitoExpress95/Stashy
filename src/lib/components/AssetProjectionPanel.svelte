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
				: view.completeness === 'unavailable'
					? 'incomplete'
					: view.completeness === 'partial' && ['healthy', 'none'].includes(view.thresholdState)
						? 'incomplete'
						: view.thresholdState
	);
	let statusLabel = $derived(
		view.safetyState === 'negative'
			? 'Below zero'
			: view.safetyState === 'zero'
				? 'At zero'
				: view.completeness === 'unavailable'
					? 'Unavailable'
					: view.completeness === 'partial' && ['healthy', 'none'].includes(view.thresholdState)
						? 'Incomplete'
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

	<div class="projected-balance">
		<span>{view.completeness === 'partial' ? 'Partial running balance' : 'Running balance'}</span>
		<strong>{view.projectedDisplay}</strong>
	</div>
	{#if view.completeness === 'partial'}
		<p class="projection-explanation">Incomplete — payments excluded.</p>
	{:else if view.completeness === 'unavailable'}
		<p class="projection-explanation">
			{view.openingBalance === null
				? 'Enter a valid opening balance to calculate this source.'
				: 'Running balance unavailable — fix the record errors.'}
		</p>
	{/if}

	{#if view.safetyState !== 'normal'}
		<div class="safety-alert">
			<strong>{view.safetyState === 'negative' ? 'Overdraft risk' : 'No cushion remains'}</strong>
			<span>
				{view.safetyState === 'negative'
					? 'Included planned payments put this asset below $0.00.'
					: 'Included planned payments leave this asset at exactly $0.00.'}
			</span>
		</div>
	{/if}
</article>
