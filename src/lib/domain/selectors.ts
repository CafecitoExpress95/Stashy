/** Read-only projections that turn saved snapshots into account history. */
import type { AccountId } from './identity';
import type { Money } from './money';
import type { Account, AccountRecord, PaymentMode, PaymentRecord, Session } from './types';

/** Optional payment context displayed with a liability history point. */
export type AccountHistoryPaymentDetails = {
	readonly paymentRecordId: PaymentRecord['id'];
	readonly sourceAssetAccountId: AccountId;
	readonly sourceAssetAccountName: string | null;
	readonly paymentMode: PaymentMode;
	readonly paymentAmount: Money;
	readonly remainingAccountBalance: Money;
	readonly remainingStatementBalance: Money;
	readonly confirmationId: string | null;
	readonly notes: string | null;
};

/** One saved point suitable for the account graph and its matching table. */
export type AccountHistoryDatapoint = {
	readonly sessionId: Session['id'];
	readonly accountRecordId: AccountRecord['id'];
	readonly sitDownDate: Session['sitDownDate'];
	readonly sessionCreatedAt: Session['createdAt'];
	readonly accountId: AccountId;
	readonly accountName: string;
	readonly accountType: Account['type'];
	readonly openingBalance: Money;
	readonly finalBalance: Money;
	readonly graphBalance: Money;
	readonly openingStatementBalance: Money | null;
	readonly finalStatementBalance: Money | null;
	readonly payment: AccountHistoryPaymentDetails | null;
};

/** Flat collections used to build history for one account. */
export type AccountHistoryInput = {
	readonly accountId: AccountId;
	readonly accounts: readonly Account[];
	readonly sessions: readonly Session[];
	readonly accountRecords: readonly AccountRecord[];
	readonly paymentRecords: readonly PaymentRecord[];
};

function paymentLookupKey(sessionId: Session['id'], liabilityAccountId: AccountId): string {
	return `${sessionId}:${liabilityAccountId}`;
}

function buildPaymentDetails(
	payment: PaymentRecord,
	accountsById: ReadonlyMap<AccountId, Account>
): AccountHistoryPaymentDetails {
	return {
		paymentRecordId: payment.id,
		sourceAssetAccountId: payment.sourceAssetAccountId,
		sourceAssetAccountName: accountsById.get(payment.sourceAssetAccountId)?.name ?? null,
		paymentMode: payment.paymentMode,
		paymentAmount: payment.paymentAmount,
		remainingAccountBalance: payment.remainingAccountBalance,
		remainingStatementBalance: payment.remainingStatementBalance,
		confirmationId: payment.confirmationId,
		notes: payment.notes
	};
}

function compareHistoryDatapoints(
	left: AccountHistoryDatapoint,
	right: AccountHistoryDatapoint
): number {
	const dateOrder = left.sitDownDate.localeCompare(right.sitDownDate);
	if (dateOrder !== 0) {
		return dateOrder;
	}

	const creationOrder = left.sessionCreatedAt.localeCompare(right.sessionCreatedAt);
	if (creationOrder !== 0) {
		return creationOrder;
	}

	return left.sessionId.localeCompare(right.sessionId);
}

/**
 * Selects saved history without inventing transactions or filling missing sessions.
 * Drafts are excluded, current account names are used, and the saved final snapshot
 * is the primary graph balance.
 */
export function selectAccountHistory(
	input: AccountHistoryInput
): readonly AccountHistoryDatapoint[] {
	const selectedAccount = input.accounts.find((account) => account.id === input.accountId);
	if (!selectedAccount) {
		return [];
	}

	const sessionsById = new Map(input.sessions.map((session) => [session.id, session]));
	const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
	const paymentsBySessionAndLiability = new Map<string, PaymentRecord>();

	for (const payment of input.paymentRecords) {
		paymentsBySessionAndLiability.set(
			paymentLookupKey(payment.sessionId, payment.liabilityAccountId),
			payment
		);
	}

	const datapoints: AccountHistoryDatapoint[] = [];
	for (const record of input.accountRecords) {
		if (record.accountId !== selectedAccount.id) {
			continue;
		}

		const session = sessionsById.get(record.sessionId);
		if (!session || session.isDraft) {
			continue;
		}

		const payment =
			selectedAccount.type === 'liability'
				? paymentsBySessionAndLiability.get(paymentLookupKey(session.id, selectedAccount.id))
				: undefined;

		datapoints.push({
			sessionId: session.id,
			accountRecordId: record.id,
			sitDownDate: session.sitDownDate,
			sessionCreatedAt: session.createdAt,
			accountId: selectedAccount.id,
			accountName: selectedAccount.name,
			accountType: selectedAccount.type,
			openingBalance: record.openingBalance,
			finalBalance: record.finalBalance,
			graphBalance: record.finalBalance,
			openingStatementBalance: record.openingStatementBalance,
			finalStatementBalance: record.finalStatementBalance,
			payment: payment ? buildPaymentDetails(payment, accountsById) : null
		});
	}

	return datapoints.sort(compareHistoryDatapoints);
}
