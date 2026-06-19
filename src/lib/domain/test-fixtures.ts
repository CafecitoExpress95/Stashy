import { calculatePayment, type AssetOpeningBalance } from './calculations';
import {
	accountIdFromString,
	accountRecordIdFromString,
	isoTimestampFromString,
	paymentRecordIdFromString,
	sessionIdFromString,
	sitDownDateFromString
} from './identity';
import { moneyFromMinorUnits } from './money';
import type {
	Account,
	DraftAccountRecord,
	DraftPaymentRecord,
	PaymentRecord,
	Session
} from './types';

export const fixtureTimestamp = isoTimestampFromString('2026-06-18T12:00:00.000Z');

export const fixtureIds = {
	checking: accountIdFromString('00000000-0000-4000-8000-000000000001'),
	savings: accountIdFromString('00000000-0000-4000-8000-000000000002'),
	cardA: accountIdFromString('00000000-0000-4000-8000-000000000003'),
	cardB: accountIdFromString('00000000-0000-4000-8000-000000000004'),
	cardC: accountIdFromString('00000000-0000-4000-8000-000000000005'),
	session: sessionIdFromString('10000000-0000-4000-8000-000000000001'),
	paymentA: paymentRecordIdFromString('20000000-0000-4000-8000-000000000001'),
	paymentB: paymentRecordIdFromString('20000000-0000-4000-8000-000000000002'),
	paymentC: paymentRecordIdFromString('20000000-0000-4000-8000-000000000003')
} as const;

export const canonicalAccounts: readonly Account[] = [
	{
		id: fixtureIds.checking,
		type: 'asset',
		name: 'Checking',
		archived: false,
		thresholdPolicy: {
			mode: 'custom',
			thresholds: {
				warningBelow: moneyFromMinorUnits(40_000),
				dangerBelow: moneyFromMinorUnits(10_000)
			}
		},
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: fixtureIds.savings,
		type: 'asset',
		name: 'Savings',
		archived: false,
		thresholdPolicy: { mode: 'off' },
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: fixtureIds.cardA,
		type: 'liability',
		name: 'Card A',
		archived: false,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: fixtureIds.cardB,
		type: 'liability',
		name: 'Card B',
		archived: false,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: fixtureIds.cardC,
		type: 'liability',
		name: 'Card C',
		archived: false,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	}
];

export const canonicalSession: Session = {
	id: fixtureIds.session,
	sitDownDate: sitDownDateFromString('2026-06-18'),
	isDraft: false,
	createdAt: fixtureTimestamp,
	updatedAt: fixtureTimestamp
};

export const canonicalAccountRecords: readonly DraftAccountRecord[] = [
	{
		id: accountRecordIdFromString('30000000-0000-4000-8000-000000000001'),
		sessionId: fixtureIds.session,
		accountId: fixtureIds.checking,
		openingBalance: moneyFromMinorUnits(100_010),
		finalBalance: moneyFromMinorUnits(32_480),
		openingStatementBalance: null,
		finalStatementBalance: null,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: accountRecordIdFromString('30000000-0000-4000-8000-000000000002'),
		sessionId: fixtureIds.session,
		accountId: fixtureIds.savings,
		openingBalance: moneyFromMinorUnits(50_000),
		finalBalance: moneyFromMinorUnits(50_000),
		openingStatementBalance: null,
		finalStatementBalance: null,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	}
];

export const canonicalPaymentDrafts: readonly DraftPaymentRecord[] = [
	{
		id: fixtureIds.paymentA,
		sessionId: fixtureIds.session,
		liabilityAccountId: fixtureIds.cardA,
		sourceAssetAccountId: fixtureIds.checking,
		paymentMode: 'statement-balance',
		startingAccountBalance: moneyFromMinorUnits(60_030),
		startingStatementBalance: moneyFromMinorUnits(40_020),
		confirmationId: null,
		notes: null,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: fixtureIds.paymentB,
		sessionId: fixtureIds.session,
		liabilityAccountId: fixtureIds.cardB,
		sourceAssetAccountId: fixtureIds.checking,
		paymentMode: 'full-balance',
		startingAccountBalance: moneyFromMinorUnits(25_000),
		startingStatementBalance: moneyFromMinorUnits(10_000),
		confirmationId: null,
		notes: null,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	},
	{
		id: fixtureIds.paymentC,
		sessionId: fixtureIds.session,
		liabilityAccountId: fixtureIds.cardC,
		sourceAssetAccountId: fixtureIds.checking,
		paymentMode: 'custom',
		customPaymentAmount: moneyFromMinorUnits(2_510),
		startingAccountBalance: moneyFromMinorUnits(2_500),
		startingStatementBalance: moneyFromMinorUnits(1_000),
		confirmationId: null,
		notes: null,
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	}
];

export const canonicalAssetOpenings: readonly AssetOpeningBalance[] = [
	{ accountId: fixtureIds.checking, openingBalance: moneyFromMinorUnits(100_010) },
	{ accountId: fixtureIds.savings, openingBalance: moneyFromMinorUnits(50_000) }
];

export function calculateCanonicalPayments(): readonly PaymentRecord[] {
	return canonicalPaymentDrafts.map((draft) => {
		const result = calculatePayment(draft);
		if (!result.ok) {
			throw new Error('Canonical payment fixture must be complete.');
		}
		return result.value;
	});
}
