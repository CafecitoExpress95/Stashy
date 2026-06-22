<script lang="ts">
	import {
		CategoryScale,
		Chart as ChartJS,
		LineElement,
		LinearScale,
		PointElement,
		Tooltip
	} from 'chart.js';
	import annotationPlugin from 'chartjs-plugin-annotation';
	import { Line } from 'svelte-chartjs';
	import type { AccountHistoryDatapoint, AccountRecordId, AssetThresholds } from '$lib/domain';
	import {
		buildAccountHistoryChartData,
		buildAccountHistoryChartOptions
	} from '$lib/charting/account-history-chart';

	ChartJS.register(
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Tooltip,
		annotationPlugin
	);

	type Props = {
		accountName: string;
		points: readonly AccountHistoryDatapoint[];
		thresholds: AssetThresholds | null;
		selectedAccountRecordId: AccountRecordId | null;
		onSelect: (accountRecordId: AccountRecordId) => void;
	};

	let { accountName, points, thresholds, selectedAccountRecordId, onSelect }: Props = $props();
	let data = $derived(buildAccountHistoryChartData(points, selectedAccountRecordId));
	let options = $derived(buildAccountHistoryChartOptions({ points, thresholds, onSelect }));
</script>

<div class="account-history-chart" data-chart-points={points.length}>
	<Line
		{data}
		{options}
		role="img"
		aria-label={accountName +
			' final balance history chart. Exact values and keyboard controls are available in the history table below.'}
	/>
</div>
