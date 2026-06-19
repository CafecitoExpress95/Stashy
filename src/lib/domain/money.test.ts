import { describe, expect, it } from 'vitest';
import {
	MoneyInvariantError,
	addMoney,
	compareMoney,
	formatMoney,
	moneyFromMinorUnits,
	parseMoneyInput,
	subtractMoney,
	sumMoney
} from './money';

describe('money parsing and formatting', () => {
	it.each([
		['1000', 100_000],
		['1000.1', 100_010],
		[' $1,000.10 ', 100_010],
		['-.50', -50],
		['-$0.10', -10],
		['0.01', 1]
	])('parses %s exactly', (input, expectedMinorUnits) => {
		const result = parseMoneyInput(input);
		expect(result).toEqual({ ok: true, value: expectedMinorUnits });
	});

	it.each([
		['', 'empty'],
		['1.234', 'unexpected-precision'],
		['$-1.00', 'malformed'],
		['(1.00)', 'malformed'],
		['1e3', 'malformed'],
		['1,00.00', 'malformed'],
		['90071992547409.92', 'overflow']
	])('rejects %s with a clear error', (input, expectedCode) => {
		const result = parseMoneyInput(input);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe(expectedCode);
			expect(result.message.length).toBeGreaterThan(0);
		}
	});

	it('formats cents as en-US USD without losing signed pennies', () => {
		expect(formatMoney(moneyFromMinorUnits(100_010))).toBe('$1,000.10');
		expect(formatMoney(moneyFromMinorUnits(-10))).toBe('-$0.10');
		expect(formatMoney(moneyFromMinorUnits(0))).toBe('$0.00');
	});
});

describe('money arithmetic', () => {
	it('preserves the canonical penny calculation exactly', () => {
		const result = subtractMoney(
			subtractMoney(moneyFromMinorUnits(10_010), moneyFromMinorUnits(10)),
			moneyFromMinorUnits(20)
		);
		expect(result).toBe(9_980);
	});

	it('adds, sums, and compares integer cents', () => {
		expect(addMoney(moneyFromMinorUnits(10), moneyFromMinorUnits(20))).toBe(30);
		expect(sumMoney([moneyFromMinorUnits(10), moneyFromMinorUnits(-5)])).toBe(5);
		expect(compareMoney(moneyFromMinorUnits(1), moneyFromMinorUnits(2))).toBe(-1);
		expect(compareMoney(moneyFromMinorUnits(2), moneyFromMinorUnits(2))).toBe(0);
	});

	it('rejects unsafe and overflowing minor-unit values', () => {
		expect(() => moneyFromMinorUnits(1.5)).toThrow(MoneyInvariantError);
		expect(() => moneyFromMinorUnits(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyInvariantError);
		expect(() =>
			addMoney(moneyFromMinorUnits(Number.MAX_SAFE_INTEGER), moneyFromMinorUnits(1))
		).toThrow(MoneyInvariantError);
	});
});
