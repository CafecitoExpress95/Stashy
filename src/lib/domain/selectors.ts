/** Read-only projections that turn saved snapshots into account history. */
import type { AccountId, IsoTimestamp, SessionId, SitDownDate } from './identity';
import { sumMoney, type Money } from './money';
import {
	getAssetThresholdState,
	resolveAssetThresholds,
	type AssetThresholdState
} from './thresholds';
import type {
	Account,
	AccountRecord,
	AppSettings,
	AssetThresholds,
	DraftPaymentRecord,
	PaymentMode,
	PaymentRecord,
	Session
} from './types';

/** Optional payment context displayed with a liability history point. */
export type AccountHistoryPaymentDetails = {
	readonly paymentRecordId: PaymentRecord['id'];
	readonly sourceAssetAccountId: AccountId;
	readonly sourceAssetAccountName: string | null;
	readonly paymentMode: PaymentMode;
	readonly paymentAmount: Money;
	readonly remainingAccountBalance: Money;
	readonly remainingStatementBalance: Money | null;
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

/** Current asset state shown in the latest stood-up Whiteboard snapshot. */
export type WhiteboardAssetState = {
	readonly accountId: AccountId;
	readonly accountRecordId: AccountRecord['id'];
	readonly accountName: string;
	readonly archived: boolean;
	readonly openingBalance: Money;
	readonly finalBalance: Money;
	readonly thresholds: AssetThresholds | null;
	readonly thresholdState: AssetThresholdState;
};

/** Current liability state shown in the latest stood-up Whiteboard snapshot. */
export type WhiteboardLiabilityState = {
	readonly accountId: AccountId;
	readonly accountRecordId: AccountRecord['id'];
	readonly accountName: string;
	readonly archived: boolean;
	readonly openingBalance: Money;
	readonly finalBalance: Money;
	readonly openingStatementBalance: Money | null;
	readonly finalStatementBalance: Money | null;
};

/** Exact account snapshots from the newest completed sit-down. */
export type WhiteboardLatestState = {
	readonly sessionId: SessionId;
	readonly sitDownDate: SitDownDate;
	readonly sessionCreatedAt: IsoTimestamp;
	readonly assets: readonly WhiteboardAssetState[];
	readonly liabilities: readonly WhiteboardLiabilityState[];
};

/** Flat saved data used to select the latest completed Whiteboard state. */
export type WhiteboardLatestStateInput = {
	readonly settings: AppSettings;
	readonly accounts: readonly Account[];
	readonly sessions: readonly Session[];
	readonly accountRecords: readonly AccountRecord[];
};

function compareSessionsNewestFirst(left: Session, right: Session): number {
	return (
		right.sitDownDate.localeCompare(left.sitDownDate) ||
		right.createdAt.localeCompare(left.createdAt) ||
		right.id.localeCompare(left.id)
	);
}

/**
 * Selects only the newest stood-up snapshot. Missing accounts are not filled
 * from older sessions, and current account names, archive state, and threshold
 * settings are applied without rewriting the saved balances.
 */
export function selectLatestStoodUpState(
	input: WhiteboardLatestStateInput
): WhiteboardLatestState | null {
	const session = [...input.sessions]
		.filter((candidate) => !candidate.isDraft)
		.sort(compareSessionsNewestFirst)[0];
	if (!session) return null;

	const recordsByAccountId = new Map(
		input.accountRecords
			.filter((record) => record.sessionId === session.id)
			.map((record) => [record.accountId, record])
	);
	const orderedAccounts = [...input.accounts].sort(
		(left, right) =>
			left.type.localeCompare(right.type) ||
			left.sortOrder - right.sortOrder ||
			left.createdAt.localeCompare(right.createdAt) ||
			left.id.localeCompare(right.id)
	);
	const assets: WhiteboardAssetState[] = [];
	const liabilities: WhiteboardLiabilityState[] = [];

	for (const account of orderedAccounts) {
		const record = recordsByAccountId.get(account.id);
		if (!record) continue;

		if (account.type === 'asset') {
			const resolved = resolveAssetThresholds(
				input.settings.defaultAssetThresholds,
				account.thresholdPolicy
			);
			const thresholds = resolved.ok ? resolved.value : null;
			assets.push({
				accountId: account.id,
				accountRecordId: record.id,
				accountName: account.name,
				archived: account.archived,
				openingBalance: record.openingBalance,
				finalBalance: record.finalBalance,
				thresholds,
				thresholdState: getAssetThresholdState(record.finalBalance, thresholds)
			});
			continue;
		}

		liabilities.push({
			accountId: account.id,
			accountRecordId: record.id,
			accountName: account.name,
			archived: account.archived,
			openingBalance: record.openingBalance,
			finalBalance: record.finalBalance,
			openingStatementBalance: record.openingStatementBalance,
			finalStatementBalance: record.finalStatementBalance
		});
	}

	return {
		sessionId: session.id,
		sitDownDate: session.sitDownDate,
		sessionCreatedAt: session.createdAt,
		assets,
		liabilities
	};
}

/** Minimum saved-session shape needed to build the Archive list. */
export type ArchiveSnapshotInput = {
	readonly session: Session;
	readonly paymentRecords: readonly (DraftPaymentRecord | PaymentRecord)[];
};

/** Concise, exact summary used by one Archive list item. */
export type ArchiveSessionSummary = {
	readonly sessionId: SessionId;
	readonly sitDownDate: SitDownDate;
	readonly createdAt: IsoTimestamp;
	readonly updatedAt: IsoTimestamp;
	readonly isDraft: boolean;
	readonly paymentCount: number;
	readonly totalPaymentAmount: Money | null;
	readonly liabilityNames: readonly string[];
	readonly remainingLiabilityCount: number;
};

function compareArchiveSnapshots(left: ArchiveSnapshotInput, right: ArchiveSnapshotInput): number {
	return (
		right.session.sitDownDate.localeCompare(left.session.sitDownDate) ||
		right.session.createdAt.localeCompare(left.session.createdAt) ||
		right.session.id.localeCompare(left.session.id)
	);
}

/** Builds newest-first Archive summaries while resolving current account names. */
export function selectArchiveSessionSummaries(
	snapshots: readonly ArchiveSnapshotInput[],
	accounts: readonly Account[]
): readonly ArchiveSessionSummary[] {
	const accountsById = new Map(accounts.map((account) => [account.id, account]));

	return [...snapshots].sort(compareArchiveSnapshots).map((snapshot) => {
		const names = snapshot.paymentRecords.map(
			(payment) => accountsById.get(payment.liabilityAccountId)?.name ?? 'Unknown account'
		);
		return {
			sessionId: snapshot.session.id,
			sitDownDate: snapshot.session.sitDownDate,
			createdAt: snapshot.session.createdAt,
			updatedAt: snapshot.session.updatedAt,
			isDraft: snapshot.session.isDraft,
			paymentCount: snapshot.paymentRecords.length,
			totalPaymentAmount: snapshot.session.isDraft
				? null
				: sumMoney(
						snapshot.paymentRecords.flatMap((payment) =>
							'paymentAmount' in payment ? [payment.paymentAmount] : []
						)
					),
			liabilityNames: names.slice(0, 3),
			remainingLiabilityCount: Math.max(0, names.length - 3)
		};
	});
}
