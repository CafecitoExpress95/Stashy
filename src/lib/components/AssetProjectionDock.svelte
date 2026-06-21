<script lang="ts">
	import type { AssetAccount, CockpitAssetView } from '$lib/domain';

	type DockAsset = {
		readonly account: AssetAccount;
		readonly view: CockpitAssetView;
	};

	type Props = {
		assets: readonly DockAsset[];
	};

	let { assets }: Props = $props();

	function visualState(view: CockpitAssetView): string {
		return view.safetyState === 'negative'
			? 'negative'
			: view.safetyState === 'zero'
				? 'zero'
				: view.thresholdState;
	}

	function statusLabel(view: CockpitAssetView): string {
		if (view.safetyState === 'negative') return 'Overdraft risk';
		if (view.safetyState === 'zero') return 'At zero';
		if (view.thresholdState === 'none') return 'No thresholds';
		return view.thresholdState[0].toUpperCase() + view.thresholdState.slice(1);
	}
</script>

<aside class="asset-summary-dock" aria-label="Live asset projections">
	<div class="asset-summary-grid">
		{#each assets as asset (asset.account.id)}
			<div class="asset-summary-item {visualState(asset.view)}">
				<span>{asset.account.name}</span>
				<strong>{asset.view.projectedDisplay}</strong>
				<small>{statusLabel(asset.view)}</small>
			</div>
		{/each}
	</div>
</aside>
