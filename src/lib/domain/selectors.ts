import type { AccountId } from './identity';
import type { Money } from './money';
import type { Account, AccountRecord, PaymentMode, PaymentRecord, Session } from './types';

export interface AccountHistoryPaymentDetails {
	readonly paymentRecordId: PaymentRecord['id'];
	readonly sourceAssetAccountId: AccountId;
	readonly sourceAssetAccountName: string | null;
	readonly paymentMode: PaymentMode;
	readonly paymentAmount: Money;
	readonly remainingAccountBalance: Money;
	readonly remainingStatementBalance: Money;
	readonly confirmationId: string | null;
	readonly notes: string | null;
}

export interface AccountHistoryDatapoint {
	readonly sessionId: Session['id'];
	readonly accountRecordId: AccountRecord['id'];
	readonly sitDownDate: Session['sitDownDate'];
	readonly sessionCreatedAt: Session['createdAt'];
	readonly accountId: AccountId;
	readonly accountName: string;
	readonly accountType: Account['type'];
	readonly openingBalance: Money;
	readonly finalBalance: Money;
	readonly balance: Money;
	readonly openingStatementBalance: Money | null;
	readonly finalStatementBalance: Money | null;
	readonly payment: AccountHistoryPaymentDetails | null;
}

export interface AccountHistoryInput {
	readonly accountId: AccountId;
	readonly accounts: readonly Account[];
	readonly sessions: readonly Session[];
	readonly accountRecords: readonly AccountRecord[];
	readonly paymentRecords: readonly PaymentRecord[];
}

export function selectAccountHistory(
	input: AccountHistoryInput
): readonly AccountHistoryDatapoint[] {
	const account = input.accounts.find((candidate) => candidate.id === input.accountId);
	if (!account) {
		return [];
	}

	const sessionsById = new Map(input.sessions.map((session) => [session.id, session]));
	const accountsById = new Map(input.accounts.map((candidate) => [candidate.id, candidate]));
	const paymentBySessionAndLiability = new Map<string, PaymentRecord>();

	for (const payment of input.paymentRecords) {
		paymentBySessionAndLiability.set(`${payment.sessionId}:${payment.liabilityAccountId}`, payment);
	}

	const datapoints: AccountHistoryDatapoint[] = [];
	for (const record of input.accountRecords) {
		if (record.accountId !== input.accountId) {
			continue;
		}

		const session = sessionsById.get(record.sessionId);
		if (!session || session.isDraft) {
			continue;
		}

		const payment =
			account.type === 'liability'
				? paymentBySessionAndLiability.get(`${session.id}:${account.id}`)
				: undefined;
		const sourceAsset = payment ? accountsById.get(payment.sourceAssetAccountId) : undefined;

		datapoints.push({
			sessionId: session.id,
			accountRecordId: record.id,
			sitDownDate: session.sitDownDate,
			sessionCreatedAt: session.createdAt,
			accountId: account.id,
			accountName: account.name,
			accountType: account.type,
			openingBalance: record.openingBalance,
			finalBalance: record.finalBalance,
			balance: record.finalBalance,
			openingStatementBalance: record.openingStatementBalance,
			finalStatementBalance: record.finalStatementBalance,
			payment: payment
				? {
						paymentRecordId: payment.id,
						sourceAssetAccountId: payment.sourceAssetAccountId,
						sourceAssetAccountName: sourceAsset?.name ?? null,
						paymentMode: payment.paymentMode,
						paymentAmount: payment.paymentAmount,
						remainingAccountBalance: payment.remainingAccountBalance,
						remainingStatementBalance: payment.remainingStatementBalance,
						confirmationId: payment.confirmationId,
						notes: payment.notes
					}
				: null
		});
	}

	return datapoints.sort((left, right) => {
		const dateOrder = left.sitDownDate.localeCompare(right.sitDownDate);
		if (dateOrder !== 0) {
			return dateOrder;
		}

		const createdOrder = left.sessionCreatedAt.localeCompare(right.sessionCreatedAt);
		if (createdOrder !== 0) {
			return createdOrder;
		}

		return left.sessionId.localeCompare(right.sessionId);
	});
}
