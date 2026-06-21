import { describe, expect, it } from 'vitest';
import { accountIdFromString } from './identity';
import { moneyFromMinorUnits } from './money';
import {
	canonicalAccountRecords,
	canonicalAccounts,
	canonicalPaymentDrafts,
	canonicalSession,
	fixtureIds
} from './test-fixtures';
import { validateDraftSession, validateStandUpSession } from './validation';

function issueCodes(result: ReturnType<typeof validateDraftSession>): string[] {
	return result.issues.map((issue) => issue.code);
}

describe('session completeness validation', () => {
	it('keeps missing draft fields as warnings', () => {
		const result = validateDraftSession({
			session: { ...canonicalSession, isDraft: true },
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: [
				{
					...canonicalPaymentDrafts[0],
					sourceAssetAccountId: undefined,
					paymentMode: undefined,
					startingAccountBalance: undefined,
					startingStatementBalance: undefined
				}
			]
		});

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings.map((issue) => issue.code)).toEqual([
			'missing-source-asset',
			'missing-payment-mode',
			'missing-starting-account-balance'
		]);
		expect(result.projectedAssetBalances?.map((asset) => asset.projectedFinalBalance)).toEqual([
			100_010, 50_000
		]);
	});

	it('requires statement data at stand-up only when statement mode is selected', () => {
		const result = validateStandUpSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: [{ ...canonicalPaymentDrafts[0], startingStatementBalance: undefined }]
		});

		expect(result.isValid).toBe(false);
		expect(result.errors.map((issue) => issue.code)).toEqual([
			'missing-starting-statement-balance'
		]);
	});

	it('upgrades calculation-critical omissions to stand-up errors', () => {
		const result = validateStandUpSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: [
				{
					...canonicalPaymentDrafts[0],
					paymentMode: 'custom',
					customPaymentAmount: undefined
				}
			]
		});

		expect(result.isValid).toBe(false);
		expect(result.errors.map((issue) => issue.code)).toEqual(['missing-custom-payment-amount']);
	});

	it('requires complete account snapshots only when standing up', () => {
		const incompleteRecord = {
			...canonicalAccountRecords[0],
			openingBalance: undefined,
			finalBalance: undefined
		};
		const input = {
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: [incompleteRecord],
			paymentRecords: []
		};

		expect(validateDraftSession(input).warnings.map((issue) => issue.code)).toEqual([
			'missing-opening-balance',
			'missing-final-balance'
		]);
		expect(validateStandUpSession(input).errors.map((issue) => issue.code)).toEqual([
			'missing-opening-balance',
			'missing-final-balance'
		]);
	});

	it('treats invalid account references as hard data errors', () => {
		const invalidId = accountIdFromString('00000000-0000-4000-8000-000000000099');
		const result = validateDraftSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: [
				{
					...canonicalPaymentDrafts[0],
					liabilityAccountId: fixtureIds.checking,
					sourceAssetAccountId: invalidId
				}
			]
		});

		expect(result.isValid).toBe(false);
		expect(issueCodes(result)).toEqual(
			expect.arrayContaining(['invalid-liability-account', 'invalid-source-asset'])
		);
	});

	it('warns in drafts and errors at stand-up when a source opening balance is unavailable', () => {
		const input = {
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords.filter(
				(record) => record.accountId !== fixtureIds.checking
			),
			paymentRecords: [canonicalPaymentDrafts[0]]
		};

		expect(validateDraftSession(input).warnings.map((issue) => issue.code)).toContain(
			'missing-source-asset-balance'
		);
		expect(validateStandUpSession(input).errors.map((issue) => issue.code)).toContain(
			'missing-source-asset-balance'
		);
	});
});

describe('financial warnings', () => {
	it('returns every applicable canonical overpayment warning without blocking save', () => {
		const result = validateStandUpSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: canonicalPaymentDrafts
		});

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings.map((issue) => issue.code)).toEqual([
			'payment-exceeds-account-balance',
			'negative-remaining-account-balance'
		]);
		expect(result.projectedAssetBalances?.map((asset) => asset.projectedFinalBalance)).toEqual([
			32_480, 50_000
		]);
		expect(result.resolvedPayments).toHaveLength(3);
	});

	it('allows negative custom payments with the agreed warning copy', () => {
		const result = validateStandUpSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: [
				{
					...canonicalPaymentDrafts[2],
					customPaymentAmount: moneyFromMinorUnits(-100)
				}
			]
		});

		expect(result.isValid).toBe(true);
		expect(result.warnings).toContainEqual(
			expect.objectContaining({
				code: 'negative-payment',
				message: 'Payment is below $0.00; check whether this is intentional.'
			})
		);
	});

	it.each([
		[100, 'zero-projected-asset-balance'],
		[101, 'negative-projected-asset-balance']
	] as const)('warns when a projected asset reaches the tested boundary', (paymentAmount, code) => {
		const result = validateStandUpSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: [
				{
					...canonicalAccountRecords[0],
					openingBalance: moneyFromMinorUnits(100),
					finalBalance: moneyFromMinorUnits(100 - paymentAmount)
				}
			],
			paymentRecords: [
				{
					...canonicalPaymentDrafts[0],
					paymentMode: 'custom',
					customPaymentAmount: moneyFromMinorUnits(paymentAmount),
					startingAccountBalance: moneyFromMinorUnits(1_000),
					startingStatementBalance: moneyFromMinorUnits(1_000)
				}
			]
		});

		expect(result.isValid).toBe(true);
		expect(result.warnings.map((issue) => issue.code)).toContain(code);
	});
});

describe('duplicate payment protection', () => {
	it('returns a hard error and refuses a trusted projection', () => {
		const result = validateDraftSession({
			session: canonicalSession,
			accounts: canonicalAccounts,
			accountRecords: canonicalAccountRecords,
			paymentRecords: [
				canonicalPaymentDrafts[0],
				{
					...canonicalPaymentDrafts[1],
					liabilityAccountId: fixtureIds.cardA
				}
			]
		});

		expect(result.isValid).toBe(false);
		expect(
			result.errors.filter((issue) => issue.code === 'duplicate-liability-payment')
		).toHaveLength(2);
		expect(result.projectedAssetBalances).toBeNull();
	});
});
