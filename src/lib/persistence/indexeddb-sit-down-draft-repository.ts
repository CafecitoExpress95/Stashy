import { isoTimestampFromString, type IsoTimestamp } from '$lib/domain';
import { openStashyDatabase, requestResult, transactionCompleted } from './indexeddb-helpers';
import {
	parseStoredDraftAccountRecord,
	parseStoredDraftPaymentRecord,
	parseStoredSession
} from './records';
import {
	ACCOUNT_RECORDS_STORE,
	ACCOUNT_RECORD_SESSION_INDEX,
	PAYMENT_RECORDS_STORE,
	PAYMENT_RECORD_SESSION_INDEX,
	SESSIONS_STORE,
	STASHY_DATABASE_VERSION
} from './schema';
import {
	SitDownDraftRepositoryError,
	type SitDownDraftRepository,
	type SitDownDraftSnapshot
} from './sit-down-draft-repository';

type RepositoryOptions = {
	readonly factory: IDBFactory;
	readonly now?: () => Date;
};

function repositoryError(error: unknown): SitDownDraftRepositoryError {
	if (error instanceof SitDownDraftRepositoryError) return error;
	if (error instanceof Error && error.name === 'ConfigurationRepositoryError') {
		return new SitDownDraftRepositoryError('corrupt-data', error.message);
	}
	return new SitDownDraftRepositoryError(
		'storage-failed',
		error instanceof Error ? error.message : 'Local draft storage failed unexpectedly.'
	);
}

function validateSnapshot(snapshot: SitDownDraftSnapshot): void {
	if (!snapshot.session.isDraft) {
		throw new SitDownDraftRepositoryError(
			'invalid-draft',
			'Phase 3 can only store unfinished sit-down drafts.'
		);
	}
	const accountIds = new Set<string>();
	for (const record of snapshot.accountRecords) {
		if (record.sessionId !== snapshot.session.id) {
			throw new SitDownDraftRepositoryError(
				'invalid-draft',
				'Every account snapshot must belong to the draft session.'
			);
		}
		if (accountIds.has(record.accountId)) {
			throw new SitDownDraftRepositoryError(
				'invalid-draft',
				'A draft cannot contain duplicate account snapshots.'
			);
		}
		accountIds.add(record.accountId);
	}
	const liabilityIds = new Set<string>();
	for (const payment of snapshot.paymentRecords) {
		if (payment.sessionId !== snapshot.session.id) {
			throw new SitDownDraftRepositoryError(
				'invalid-draft',
				'Every payment must belong to the draft session.'
			);
		}
		if (!accountIds.has(payment.liabilityAccountId)) {
			throw new SitDownDraftRepositoryError(
				'invalid-draft',
				'Every payment liability must have a draft account snapshot.'
			);
		}
		if (
			payment.sourceAssetAccountId !== undefined &&
			!accountIds.has(payment.sourceAssetAccountId)
		) {
			throw new SitDownDraftRepositoryError(
				'invalid-draft',
				'Every selected source asset must have a draft account snapshot.'
			);
		}
		if (liabilityIds.has(payment.liabilityAccountId)) {
			throw new SitDownDraftRepositoryError(
				'invalid-draft',
				'A draft cannot contain duplicate liability payments.'
			);
		}
		liabilityIds.add(payment.liabilityAccountId);
	}
}

export class IndexedDbSitDownDraftRepository implements SitDownDraftRepository {
	readonly #factory: IDBFactory;
	readonly #now: () => Date;
	#databasePromise: Promise<IDBDatabase> | null = null;

	constructor(options: RepositoryOptions) {
		this.#factory = options.factory;
		this.#now = options.now ?? (() => new Date());
	}

	async loadLatestDraft(): Promise<SitDownDraftSnapshot | null> {
		try {
			const database = await this.#getDatabase();
			const sessionTransaction = database.transaction(SESSIONS_STORE, 'readonly');
			const sessionCompleted = transactionCompleted(sessionTransaction);
			const rawSessions = await requestResult(
				sessionTransaction.objectStore(SESSIONS_STORE).getAll()
			);
			await sessionCompleted;
			const latest = (rawSessions as unknown[])
				.map(parseStoredSession)
				.filter((session) => session.isDraft)
				.sort(
					(left, right) =>
						right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id)
				)[0];
			if (!latest) return null;

			const recordsTransaction = database.transaction(
				[ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
				'readonly'
			);
			const recordsCompleted = transactionCompleted(recordsTransaction);
			const [rawAccountRecords, rawPaymentRecords] = await Promise.all([
				requestResult(
					recordsTransaction
						.objectStore(ACCOUNT_RECORDS_STORE)
						.index(ACCOUNT_RECORD_SESSION_INDEX)
						.getAll(latest.id)
				),
				requestResult(
					recordsTransaction
						.objectStore(PAYMENT_RECORDS_STORE)
						.index(PAYMENT_RECORD_SESSION_INDEX)
						.getAll(latest.id)
				)
			]);
			await recordsCompleted;
			const snapshot: SitDownDraftSnapshot = {
				session: latest,
				accountRecords: (rawAccountRecords as unknown[]).map(parseStoredDraftAccountRecord),
				paymentRecords: (rawPaymentRecords as unknown[]).map(parseStoredDraftPaymentRecord)
			};
			validateSnapshot(snapshot);
			return snapshot;
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async saveDraft(snapshot: SitDownDraftSnapshot): Promise<SitDownDraftSnapshot> {
		validateSnapshot(snapshot);
		try {
			const database = await this.#getDatabase();
			const timestamp = this.#timestamp();
			const saved: SitDownDraftSnapshot = {
				session: { ...snapshot.session, isDraft: true, updatedAt: timestamp },
				accountRecords: snapshot.accountRecords.map((record) => ({
					...record,
					updatedAt: timestamp
				})),
				paymentRecords: snapshot.paymentRecords.map((record) => ({
					...record,
					updatedAt: timestamp
				}))
			};
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
				'readwrite'
			);
			const completed = transactionCompleted(transaction);
			const sessionStore = transaction.objectStore(SESSIONS_STORE);
			const accountStore = transaction.objectStore(ACCOUNT_RECORDS_STORE);
			const paymentStore = transaction.objectStore(PAYMENT_RECORDS_STORE);
			const [existingAccountRecords, existingPaymentRecords] = await Promise.all([
				requestResult(accountStore.index(ACCOUNT_RECORD_SESSION_INDEX).getAll(snapshot.session.id)),
				requestResult(paymentStore.index(PAYMENT_RECORD_SESSION_INDEX).getAll(snapshot.session.id))
			]);
			const nextAccountRecordIds = new Set<string>(saved.accountRecords.map((record) => record.id));
			const nextPaymentRecordIds = new Set<string>(saved.paymentRecords.map((record) => record.id));
			const requests: Array<Promise<unknown>> = [requestResult(sessionStore.put(saved.session))];
			for (const raw of existingAccountRecords as Array<{ id: string }>) {
				if (!nextAccountRecordIds.has(raw.id)) {
					requests.push(requestResult(accountStore.delete(raw.id)));
				}
			}
			for (const raw of existingPaymentRecords as Array<{ id: string }>) {
				if (!nextPaymentRecordIds.has(raw.id)) {
					requests.push(requestResult(paymentStore.delete(raw.id)));
				}
			}
			for (const record of saved.accountRecords) {
				requests.push(requestResult(accountStore.put(record)));
			}
			for (const record of saved.paymentRecords) {
				requests.push(requestResult(paymentStore.put(record)));
			}
			await Promise.all(requests);
			await completed;
			return saved;
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async #getDatabase(): Promise<IDBDatabase> {
		this.#databasePromise ??= openStashyDatabase(this.#factory).then((database) => {
			database.onversionchange = () => {
				database.close();
				this.#databasePromise = null;
			};
			return database;
		});
		return this.#databasePromise;
	}

	#timestamp(): IsoTimestamp {
		return isoTimestampFromString(this.#now().toISOString());
	}
}

export function createBrowserSitDownDraftRepository(): IndexedDbSitDownDraftRepository {
	if (typeof indexedDB === 'undefined') {
		throw new SitDownDraftRepositoryError(
			'storage-unavailable',
			'IndexedDB is unavailable in this browser.'
		);
	}
	return new IndexedDbSitDownDraftRepository({ factory: indexedDB });
}

export { STASHY_DATABASE_VERSION };
