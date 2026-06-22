import { describe, expect, it, vi } from 'vitest';
import type { ActiveElement, Chart, ChartEvent, PointElement } from 'chart.js';
import {
	accountRecordIdFromString,
	moneyFromMinorUnits,
	type AccountHistoryDatapoint,
	type AssetThresholds
} from '$lib/domain';
import { canonicalSession, fixtureIds, fixtureTimestamp } from '$lib/domain/test-fixtures';
import {
	buildAccountHistoryChartData,
	buildAccountHistoryChartOptions
} from './account-history-chart';

const firstId = accountRecordIdFromString('70000000-0000-4000-8000-000000000001');
const secondId = accountRecordIdFromString('70000000-0000-4000-8000-000000000002');

const points: readonly AccountHistoryDatapoint[] = [
	{
		sessionId: canonicalSession.id,
		accountRecordId: firstId,
		sitDownDate: canonicalSession.sitDownDate,
		sessionCreatedAt: canonicalSession.createdAt,
		accountId: fixtureIds.checking,
		accountName: 'Checking',
		accountType: 'asset',
		openingBalance: moneyFromMinorUnits(10_010),
		finalBalance: moneyFromMinorUnits(9_999),
		graphBalance: moneyFromMinorUnits(9_999),
		openingStatementBalance: null,
		finalStatementBalance: null,
		payment: null
	},
	{
		sessionId: canonicalSession.id,
		accountRecordId: secondId,
		sitDownDate: canonicalSession.sitDownDate,
		sessionCreatedAt: fixtureTimestamp,
		accountId: fixtureIds.checking,
		accountName: 'Checking',
		accountType: 'asset',
		openingBalance: moneyFromMinorUnits(9_999),
		finalBalance: moneyFromMinorUnits(-25),
		graphBalance: moneyFromMinorUnits(-25),
		openingStatementBalance: null,
		finalStatementBalance: null,
		payment: null
	}
];

const thresholds: AssetThresholds = {
	warningBelow: moneyFromMinorUnits(40_000),
	dangerBelow: moneyFromMinorUnits(10_000)
};

describe('account history Chart.js adapter', () => {
	it('keeps exact cents and duplicate dates as separate ordered categories', () => {
		const data = buildAccountHistoryChartData(points, secondId);

		expect(data.labels).toEqual(['2026-06-18', '2026-06-18']);
		expect(data.datasets[0].data).toEqual([9_999, -25]);
		expect(data.datasets[0].pointRadius).toEqual([5, 7]);
	});

	it('adds exact current threshold annotations and selects clicked records', () => {
		const onSelect = vi.fn();
		const options = buildAccountHistoryChartOptions({ points, thresholds, onSelect });
		const annotations = options.plugins?.annotation?.annotations;
		if (!annotations || Array.isArray(annotations)) {
			throw new Error('Expected named threshold annotations.');
		}

		expect(annotations.warning).toEqual(expect.objectContaining({ yMin: 40_000, yMax: 40_000 }));
		expect(annotations.danger).toEqual(expect.objectContaining({ yMin: 10_000, yMax: 10_000 }));

		const active: ActiveElement = {
			datasetIndex: 0,
			index: 1,
			element: {} as PointElement
		};
		options.onClick?.({} as ChartEvent, [active], {} as Chart<'line'>);
		expect(onSelect).toHaveBeenCalledWith(secondId);
	});
});
