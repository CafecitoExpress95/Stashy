import { describe, expect, it } from 'vitest';
import { moneyFromMinorUnits } from './money';
import {
	getAssetThresholdState,
	resolveAssetThresholds,
	validateAssetThresholds
} from './thresholds';

const thresholds = {
	warningBelow: moneyFromMinorUnits(40_000),
	dangerBelow: moneyFromMinorUnits(10_000)
};

describe('asset threshold states', () => {
	it.each([
		[40_001, 'healthy'],
		[40_000, 'healthy'],
		[39_999, 'warning'],
		[32_480, 'warning'],
		[10_001, 'warning'],
		[10_000, 'warning'],
		[9_999, 'danger']
	] as const)('classifies %i cents as %s', (balance, expected) => {
		expect(getAssetThresholdState(moneyFromMinorUnits(balance), thresholds)).toBe(expected);
	});

	it('returns no threshold color when thresholds are disabled', () => {
		expect(getAssetThresholdState(moneyFromMinorUnits(-1), null)).toBe('none');
	});
});

describe('threshold policy resolution', () => {
	it('supports inheriting defaults, custom overrides, and disabling colors', () => {
		expect(resolveAssetThresholds(thresholds, { mode: 'inherit' })).toEqual({
			ok: true,
			value: thresholds
		});

		const custom = {
			warningBelow: moneyFromMinorUnits(20_000),
			dangerBelow: moneyFromMinorUnits(5_000)
		};
		expect(resolveAssetThresholds(thresholds, { mode: 'custom', thresholds: custom })).toEqual({
			ok: true,
			value: custom
		});
		expect(resolveAssetThresholds(thresholds, { mode: 'off' })).toEqual({
			ok: true,
			value: null
		});
		expect(resolveAssetThresholds(null, { mode: 'inherit' })).toEqual({
			ok: true,
			value: null
		});
	});

	it.each([
		[10_000, 10_000],
		[9_999, 10_000]
	])('rejects danger %i when warning is %i', (warningBelow, dangerBelow) => {
		const result = validateAssetThresholds({
			warningBelow: moneyFromMinorUnits(warningBelow),
			dangerBelow: moneyFromMinorUnits(dangerBelow)
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors[0].code).toBe('invalid-threshold-order');
		}
	});
});
