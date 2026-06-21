import { describe, expect, it } from 'vitest';
import { calculatePayment, calculateProjectedAssetBalances } from './calculations';
import { moneyFromMinorUnits } from './money';
import {
	calculateCanonicalPayments,
	canonicalAssetOpenings,
	canonicalPaymentDrafts,
	fixtureIds
} from './test-fixtures';

describe('payment calculations', () => {
	it('calculates full-balance payments from the account balance', () => {
		const result = calculatePayment(canonicalPaymentDrafts[1]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.paymentAmount).toBe(25_000);
			expect(result.value.remainingAccountBalance).toBe(0);
			expect(result.value.remainingStatementBalance).toBe(0);
		}
	});

	it('calculates statement-balance payments from the statement balance', () => {
		const result = calculatePayment(canonicalPaymentDrafts[0]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.paymentAmount).toBe(40_020);
			expect(result.value.remainingAccountBalance).toBe(20_010);
			expect(result.value.remainingStatementBalance).toBe(0);
		}
	});

	it('calculates custom payments while flooring the remaining statement balance at zero', () => {
		const result = calculatePayment(canonicalPaymentDrafts[2]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.paymentAmount).toBe(2_510);
			expect(result.value.remainingAccountBalance).toBe(-10);
			expect(result.value.remainingStatementBalance).toBe(0);
		}
	});

	it.each([
		[1_000, 250, 750],
		[1_000, 1_000, 0],
		[1_000, 1_001, 0],
		[0, 100, 0],
		[-100, -50, 0]
	] as const)(
		'floors a provided statement balance of %i after a payment of %i at %i',
		(startingStatementBalance, customPaymentAmount, expected) => {
			const result = calculatePayment({
				...canonicalPaymentDrafts[2],
				startingStatementBalance: moneyFromMinorUnits(startingStatementBalance),
				customPaymentAmount: moneyFromMinorUnits(customPaymentAmount)
			});
			expect(result.ok && result.value.remainingStatementBalance).toBe(expected);
		}
	);

	it('recalculates from the correct starting balance when the mode changes', () => {
		const base = canonicalPaymentDrafts[0];
		const full = calculatePayment({ ...base, paymentMode: 'full-balance' });
		const statement = calculatePayment({ ...base, paymentMode: 'statement-balance' });
		const custom = calculatePayment({
			...base,
			paymentMode: 'custom',
			customPaymentAmount: moneyFromMinorUnits(12_345)
		});

		expect(full.ok && full.value.paymentAmount).toBe(60_030);
		expect(statement.ok && statement.value.paymentAmount).toBe(40_020);
		expect(custom.ok && custom.value.paymentAmount).toBe(12_345);
	});

	it('allows full and custom payments to omit statement data', () => {
		const full = calculatePayment({
			...canonicalPaymentDrafts[1],
			startingStatementBalance: undefined
		});
		const custom = calculatePayment({
			...canonicalPaymentDrafts[2],
			startingStatementBalance: undefined
		});

		expect(full.ok && full.value.startingStatementBalance).toBeNull();
		expect(full.ok && full.value.remainingStatementBalance).toBeNull();
		expect(custom.ok && custom.value.startingStatementBalance).toBeNull();
		expect(custom.ok && custom.value.remainingStatementBalance).toBeNull();
	});

	it('returns explicit errors when calculation-critical fields are missing', () => {
		const result = calculatePayment({
			...canonicalPaymentDrafts[0],
			sourceAssetAccountId: undefined,
			paymentMode: undefined,
			startingAccountBalance: undefined,
			startingStatementBalance: undefined
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.map((error) => error.code)).toEqual([
				'missing-source-asset',
				'missing-payment-mode',
				'missing-starting-account-balance'
			]);
		}
	});

	it('requires statement data only for statement-balance mode', () => {
		const result = calculatePayment({
			...canonicalPaymentDrafts[0],
			startingStatementBalance: undefined
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.map((error) => error.code)).toEqual([
				'missing-starting-statement-balance'
			]);
		}
	});
});

describe('asset projections', () => {
	it('matches every result in the canonical acceptance scenario', () => {
		const payments = calculateCanonicalPayments();
		const result = calculateProjectedAssetBalances(canonicalAssetOpenings, payments);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual([
				{
					accountId: fixtureIds.checking,
					openingBalance: 100_010,
					projectedFinalBalance: 32_480
				},
				{
					accountId: fixtureIds.savings,
					openingBalance: 50_000,
					projectedFinalBalance: 50_000
				}
			]);
		}
	});

	it('subtracts each payment from its own source asset', () => {
		const [first, second] = calculateCanonicalPayments();
		const result = calculateProjectedAssetBalances(canonicalAssetOpenings, [
			first,
			{ ...second, sourceAssetAccountId: fixtureIds.savings }
		]);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.map((asset) => asset.projectedFinalBalance)).toEqual([59_990, 25_000]);
		}
	});

	it('preserves penny precision across multiple payments', () => {
		const [first, second] = calculateCanonicalPayments();
		const result = calculateProjectedAssetBalances(
			[{ accountId: fixtureIds.checking, openingBalance: moneyFromMinorUnits(10_010) }],
			[
				{ ...first, paymentAmount: moneyFromMinorUnits(10) },
				{
					...second,
					paymentAmount: moneyFromMinorUnits(20),
					sourceAssetAccountId: fixtureIds.checking
				}
			]
		);

		expect(result.ok && result.value[0].projectedFinalBalance).toBe(9_980);
	});

	it('rejects duplicate liability payments without returning a projection', () => {
		const [payment] = calculateCanonicalPayments();
		const result = calculateProjectedAssetBalances(canonicalAssetOpenings, [
			payment,
			{ ...payment, id: fixtureIds.paymentB }
		]);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.map((error) => error.code)).toContain('duplicate-liability-payment');
		}
	});
});
