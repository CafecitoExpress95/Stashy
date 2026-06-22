/** Chart.js adaptation for exact saved account-history snapshots. */
import type { ActiveElement, ChartData, ChartEvent, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
	formatMoney,
	moneyFromMinorUnits,
	type AccountHistoryDatapoint,
	type AccountRecordId,
	type AssetThresholds
} from '$lib/domain';

export type AccountHistoryLineData = ChartData<'line', number[], string>;

export type AccountHistoryChartOptionsInput = {
	readonly points: readonly AccountHistoryDatapoint[];
	readonly thresholds: AssetThresholds | null;
	readonly onSelect: (accountRecordId: AccountRecordId) => void;
};

function chartMoney(value: number): string {
	return formatMoney(moneyFromMinorUnits(Math.round(value)));
}

/** Builds the exact integer-cent series and selected-point presentation. */
export function buildAccountHistoryChartData(
	points: readonly AccountHistoryDatapoint[],
	selectedAccountRecordId: AccountRecordId | null
): AccountHistoryLineData {
	return {
		labels: points.map((point) => point.sitDownDate),
		datasets: [
			{
				label: 'Final balance',
				data: points.map((point) => point.graphBalance),
				borderColor: '#8b3d05',
				backgroundColor: '#8b3d05',
				pointBackgroundColor: points.map((point) =>
					point.accountRecordId === selectedAccountRecordId ? '#526414' : '#fffaf0'
				),
				pointBorderColor: points.map((point) =>
					point.accountRecordId === selectedAccountRecordId ? '#526414' : '#8b3d05'
				),
				pointRadius: points.map((point) =>
					point.accountRecordId === selectedAccountRecordId ? 7 : 5
				),
				pointHoverRadius: 8,
				pointHitRadius: 16,
				borderWidth: 3,
				tension: 0.18,
				fill: false
			}
		]
	};
}

function thresholdAnnotations(
	thresholds: AssetThresholds | null
): Record<string, AnnotationOptions> {
	if (!thresholds) return {};

	return {
		warning: {
			type: 'line',
			yMin: thresholds.warningBelow,
			yMax: thresholds.warningBelow,
			borderColor: '#a45f0a',
			borderDash: [7, 5],
			borderWidth: 2,
			label: {
				display: true,
				content: 'Current warning: ' + formatMoney(thresholds.warningBelow),
				position: 'end',
				backgroundColor: '#fff4d9',
				color: '#704208',
				font: { size: 11, weight: 'bold' }
			}
		},
		danger: {
			type: 'line',
			yMin: thresholds.dangerBelow,
			yMax: thresholds.dangerBelow,
			borderColor: '#9d352f',
			borderDash: [7, 5],
			borderWidth: 2,
			label: {
				display: true,
				content: 'Current danger: ' + formatMoney(thresholds.dangerBelow),
				position: 'start',
				backgroundColor: '#fbe7e1',
				color: '#742722',
				font: { size: 11, weight: 'bold' }
			}
		}
	};
}

/** Builds responsive interaction, money formatting, and current-threshold annotations. */
export function buildAccountHistoryChartOptions({
	points,
	thresholds,
	onSelect
}: AccountHistoryChartOptionsInput): ChartOptions<'line'> {
	return {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		interaction: {
			mode: 'nearest',
			axis: 'x',
			intersect: false
		},
		onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
			const point = points[elements[0]?.index];
			if (point) onSelect(point.accountRecordId);
		},
		plugins: {
			legend: { display: false },
			tooltip: {
				displayColors: false,
				callbacks: {
					title: (items) => {
						const point = points[items[0]?.dataIndex];
						return point ? 'Sit-down ' + point.sitDownDate : '';
					},
					label: (item) => {
						const point = points[item.dataIndex];
						return point ? 'Final balance: ' + formatMoney(point.graphBalance) : '';
					}
				}
			},
			annotation: {
				annotations: thresholdAnnotations(thresholds)
			}
		},
		scales: {
			x: {
				title: { display: true, text: 'Sit-down date' },
				grid: { display: false },
				ticks: { autoSkip: true, maxRotation: 0 }
			},
			y: {
				title: { display: true, text: 'Final balance' },
				grace: '12%',
				ticks: {
					callback: (value) => chartMoney(Number(value))
				}
			}
		}
	};
}
