import { describe, expect, it } from 'vitest';
import {
	accountRecordIdFromString,
	paymentRecordIdFromString,
	sessionIdFromString
} from './identity';
import {
	createCockpitForm,
	deriveCockpit,
	getCockpitDraftData,
	hydrateCockpitForm
} from './cockpit';
import { canonicalAccounts, fixtureTimestamp } from './test-fixtures';
import type { AppSettings } from './types';
import { appSettingsIdFromString } from './identity';

const settings: AppSettings = {
	id: appSettingsIdFromString('90000000-0000-4000-8000-000000000001'),
	schemaVersion: 1,
	currency: 'USD',
	defaultAssetThresholds: null,
	lastImportedAt: null,
	lastExportedAt: null,
	createdAt: fixtureTimestamp,
	updatedAt: fixtureTimestamp
};

function freshForm() {
	let accountRecord = 1;
	let paymentRecord = 1;
	return createCockpitForm(canonicalAccounts, '2026-06-20', fixtureTimestamp, {
		sessionId: () => sessionIdFromString('90000000-0000-4000-8000-000000000002'),
		accountRecordId: () =>
			accountRecordIdFromString(
				`91000000-0000-4000-8000-${String(accountRecord++).padStart(12, '0')}`
			),
		paymentRecordId: () =>
			paymentRecordIdFromString(
				`92000000-0000-4000-8000-${String(paymentRecord++).padStart(12, '0')}`
			)
	});
}

function enterAssetOpenings(form: ReturnType<typeof freshForm>) {
	form.assets[0].openingBalanceText = '$1,000.10';
	form.assets[1].openingBalanceText = '$500.00';
}

describe('cockpit initialization', () => {
	it('uses configured active ordering and leaves payment choices explicit', () => {
		const form = freshForm();
		expect(form.assets.map((asset) => asset.accountId)).toEqual([
			canonicalAccounts[0].id,
			canonicalAccounts[1].id
		]);
		expect(form.payments.map((payment) => payment.liabilityAccountId)).toEqual([
			canonicalAccounts[2].id,
			canonicalAccounts[3].id,
			canonicalAccounts[4].id
		]);
		expect(form.payments.every((payment) => payment.sourceAssetAccountId === '')).toBe(true);
		expect(form.payments.every((payment) => payment.paymentMode === '')).toBe(true);
	});
});

describe('cockpit derivation', () => {
	it('projects complete rows while later draft rows remain unfinished', () => {
		const form = freshForm();
		enterAssetOpenings(form);
		Object.assign(form.payments[0], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'statement-balance',
			startingAccountBalanceText: '$600.30',
			startingStatementBalanceText: '$400.20'
		});

		const result = deriveCockpit(form, canonicalAccounts, settings);
		expect(result.assets.map((asset) => asset.projectedFinalBalance)).toEqual([59_990, 50_000]);
		expect(result.payments[0].paymentAmountDisplay).toBe('$400.20');
		expect(result.payments[1].paymentAmountDisplay).toBe('—');
		expect(result.draftValidation?.projectedAssetBalances).not.toBeNull();
		expect(result.standUpValidation?.projectedAssetBalances).toBeNull();
	});

	it('projects full and custom payments without statement balances', () => {
		const form = freshForm();
		enterAssetOpenings(form);
		Object.assign(form.payments[0], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'full-balance',
			startingAccountBalanceText: '$100.00'
		});
		Object.assign(form.payments[1], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'custom',
			startingAccountBalanceText: '$50.00',
			customPaymentAmountText: '$25.00'
		});

		const result = deriveCockpit(form, canonicalAccounts, settings);
		expect(result.assets[0].projectedFinalBalance).toBe(87_510);
		expect(result.payments[0].remainingStatementBalanceDisplay).toBe('\u2014');
		expect(result.payments[1].remainingStatementBalanceDisplay).toBe('\u2014');
	});

	it('hydrates an omitted statement balance without inventing zero', () => {
		const form = freshForm();
		enterAssetOpenings(form);
		Object.assign(form.payments[0], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'full-balance',
			startingAccountBalanceText: '$100.00'
		});
		const derivation = deriveCockpit(form, canonicalAccounts, settings);
		const draft = getCockpitDraftData(derivation);
		if (!draft) throw new Error('Expected a saveable draft.');

		const hydrated = hydrateCockpitForm(draft, canonicalAccounts);
		expect(hydrated.payments[0].startingStatementBalanceText).toBe('');
		expect(
			deriveCockpit(hydrated, canonicalAccounts, settings).assets[0].projectedFinalBalance
		).toBe(90_010);
	});

	it('moves a payment from its old source to its new source exactly once', () => {
		const form = freshForm();
		enterAssetOpenings(form);
		Object.assign(form.payments[0], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'custom',
			startingAccountBalanceText: '$100.00',
			startingStatementBalanceText: '$100.00',
			customPaymentAmountText: '$25.00'
		});
		expect(
			deriveCockpit(form, canonicalAccounts, settings).assets.map(
				(asset) => asset.projectedFinalBalance
			)
		).toEqual([97_510, 50_000]);

		form.payments[0].sourceAssetAccountId = canonicalAccounts[1].id;
		expect(
			deriveCockpit(form, canonicalAccounts, settings).assets.map(
				(asset) => asset.projectedFinalBalance
			)
		).toEqual([100_010, 47_500]);
	});

	it('blocks malformed money from draft saving without blocking blank draft fields', () => {
		const form = freshForm();
		let result = deriveCockpit(form, canonicalAccounts, settings);
		expect(result.canSaveDraft).toBe(true);
		expect(getCockpitDraftData(result)).not.toBeNull();

		form.assets[0].openingBalanceText = '$10.001';
		result = deriveCockpit(form, canonicalAccounts, settings);
		expect(result.canSaveDraft).toBe(false);
		expect(result.fieldErrors[0].message).toContain('two decimal places');
		expect(getCockpitDraftData(result)).toBeNull();
	});

	it('applies threshold and overdraft states to the live projection', () => {
		const form = freshForm();
		form.assets[0].openingBalanceText = '$100.00';
		form.assets[1].openingBalanceText = '$500.00';
		Object.assign(form.payments[0], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'custom',
			startingAccountBalanceText: '$200.00',
			startingStatementBalanceText: '$200.00',
			customPaymentAmountText: '$100.01'
		});
		const result = deriveCockpit(form, canonicalAccounts, settings);
		expect(result.assets[0]).toMatchObject({
			projectedDisplay: '-$0.01',
			thresholdState: 'danger',
			safetyState: 'negative'
		});
		expect(result.assets[0].issues.map((issue) => issue.code)).toContain(
			'negative-projected-asset-balance'
		);
	});

	it('keeps confirmation IDs and notes out of money calculations', () => {
		const form = freshForm();
		enterAssetOpenings(form);
		Object.assign(form.payments[0], {
			sourceAssetAccountId: canonicalAccounts[0].id,
			paymentMode: 'full-balance',
			startingAccountBalanceText: '$25.00',
			startingStatementBalanceText: '$10.00'
		});
		const before = deriveCockpit(form, canonicalAccounts, settings);
		form.payments[0].confirmationId = 'ABC-123';
		form.payments[0].notes = 'Pending at the bank';
		const after = deriveCockpit(form, canonicalAccounts, settings);
		expect(after.assets.map((asset) => asset.projectedFinalBalance)).toEqual(
			before.assets.map((asset) => asset.projectedFinalBalance)
		);
		expect(after.payments[0].remainingAccountBalanceDisplay).toBe('$0.00');
	});
});
