import { describe, expect, it } from 'vitest';
import { calculatePayment } from './calculations';
import {
	accountRecordIdFromString,
	isoTimestampFromString,
	sessionIdFromString,
	sitDownDateFromString
} from './identity';
import { moneyFromMinorUnits } from './money';
import { selectAccountHistory } from './selectors';
import {
	canonicalAccounts,
	canonicalPaymentDrafts,
	canonicalSession,
	fixtureIds,
	fixtureTimestamp
} from './test-fixtures';
import type { AccountRecord, Session } from './types';

const laterSession: Session = {
	...canonicalSession,
	id: sessionIdFromString('10000000-0000-4000-8000-000000000003'),
	sitDownDate: sitDownDateFromString('2026-06-20'),
	createdAt: isoTimestampFromString('2026-06-20T12:00:00.000Z'),
	updatedAt: isoTimestampFromString('2026-06-20T12:00:00.000Z')
};

const draftSession: Session = {
	...canonicalSession,
	id: sessionIdFromString('10000000-0000-4000-8000-000000000002'),
	sitDownDate: sitDownDateFromString('2026-06-19'),
	isDraft: true,
	createdAt: isoTimestampFromString('2026-06-19T12:00:00.000Z'),
	updatedAt: isoTimestampFromString('2026-06-19T12:00:00.000Z')
};

function liabilityRecord(
	idSuffix: string,
	sessionId: Session['id'],
	opening: number,
	final: number,
	statementOpening: number,
	statementFinal: number
): AccountRecord {
	return {
		id: accountRecordIdFromString(`40000000-0000-4000-8000-${idSuffix}`),
		sessionId,
		accountId: fixtureIds.cardA,
		openingBalance: moneyFromMinorUnits(opening),
		finalBalance: moneyFromMinorUnits(final),
		openingStatementBalance: moneyFromMinorUnits(statementOpening),
		finalStatementBalance: moneyFromMinorUnits(statementFinal),
		createdAt: fixtureTimestamp,
		updatedAt: fixtureTimestamp
	};
}

describe('account history selector', () => {
	it('uses saved snapshots, current names, and optional payment details without filling gaps', () => {
		const paymentResult = calculatePayment(canonicalPaymentDrafts[0]);
		if (!paymentResult.ok) {
			throw new Error('Fixture payment must calculate.');
		}

		const accounts = canonicalAccounts.map((account) => {
			if (account.id === fixtureIds.cardA) {
				return { ...account, name: 'Renamed Card A' };
			}
			if (account.id === fixtureIds.checking) {
				return { ...account, name: 'Household Checking' };
			}
			return account;
		});
		const records = [
			liabilityRecord('000000000001', canonicalSession.id, 60_030, 20_010, 40_020, 0),
			liabilityRecord('000000000002', draftSession.id, 99_999, 99_999, 99_999, 99_999),
			liabilityRecord('000000000003', laterSession.id, 21_000, 21_000, 5_000, 5_000)
		];

		const history = selectAccountHistory({
			accountId: fixtureIds.cardA,
			accounts,
			sessions: [laterSession, draftSession, canonicalSession],
			accountRecords: records,
			paymentRecords: [paymentResult.value]
		});

		expect(history.map((point) => point.sitDownDate)).toEqual(['2026-06-18', '2026-06-20']);
		expect(history.map((point) => point.balance)).toEqual([20_010, 21_000]);
		expect(history.every((point) => point.accountName === 'Renamed Card A')).toBe(true);
		expect(history[0].payment).toEqual(
			expect.objectContaining({
				paymentAmount: 40_020,
				sourceAssetAccountName: 'Household Checking'
			})
		);
		expect(history[1].payment).toBeNull();
	});

	it('sorts same-date snapshots by session creation time and then ID', () => {
		const firstCreated = {
			...canonicalSession,
			id: sessionIdFromString('10000000-0000-4000-8000-000000000009'),
			createdAt: isoTimestampFromString('2026-06-18T11:00:00.000Z')
		};
		const secondCreated = {
			...canonicalSession,
			id: sessionIdFromString('10000000-0000-4000-8000-000000000008'),
			createdAt: isoTimestampFromString('2026-06-18T12:00:00.000Z')
		};
		const records = [
			liabilityRecord('000000000008', secondCreated.id, 200, 150, 100, 50),
			liabilityRecord('000000000009', firstCreated.id, 100, 75, 50, 25)
		];

		const history = selectAccountHistory({
			accountId: fixtureIds.cardA,
			accounts: canonicalAccounts,
			sessions: [secondCreated, firstCreated],
			accountRecords: records,
			paymentRecords: []
		});

		expect(history.map((point) => point.sessionId)).toEqual([firstCreated.id, secondCreated.id]);
	});

	it('returns asset history from saved account snapshots', () => {
		const record: AccountRecord = {
			id: accountRecordIdFromString('40000000-0000-4000-8000-000000000010'),
			sessionId: canonicalSession.id,
			accountId: fixtureIds.checking,
			openingBalance: moneyFromMinorUnits(100_010),
			finalBalance: moneyFromMinorUnits(32_480),
			openingStatementBalance: null,
			finalStatementBalance: null,
			createdAt: fixtureTimestamp,
			updatedAt: fixtureTimestamp
		};

		const history = selectAccountHistory({
			accountId: fixtureIds.checking,
			accounts: canonicalAccounts,
			sessions: [canonicalSession],
			accountRecords: [record],
			paymentRecords: []
		});

		expect(history).toHaveLength(1);
		expect(history[0]).toEqual(
			expect.objectContaining({ accountType: 'asset', balance: 32_480, payment: null })
		);
	});

	it('returns no datapoints for an unknown account instead of inferring history', () => {
		expect(
			selectAccountHistory({
				accountId: fixtureIds.cardC,
				accounts: canonicalAccounts.filter((account) => account.id !== fixtureIds.cardC),
				sessions: [canonicalSession],
				accountRecords: [],
				paymentRecords: []
			})
		).toEqual([]);
	});
});
