import { isoTimestampFromString, type IsoTimestamp } from '$lib/domain';
import { openStashyDatabase, requestResult, transactionCompleted } from './indexeddb-helpers';
import {
	parseStoredAccountRecord,
	parseStoredDraftAccountRecord,
	parseStoredDraftPaymentRecord,
	parseStoredPaymentRecord,
	parseStoredSession
} from './records';
import {
	ACCOUNT_RECORDS_STORE,
	ACCOUNT_RECORD_SESSION_INDEX,
	PAYMENT_RECORDS_STORE,
	PAYMENT_RECORD_SESSION_INDEX,
	SESSIONS_STORE,
	SESSION_UPDATED_AT_INDEX,
	STASHY_DATABASE_VERSION
} from './schema';
import {
	SitDownRepositoryError,
	type SitDownDraftSnapshot,
	type SitDownRepository,
	type SitDownSnapshot,
	type StoodUpSitDownSnapshot
} from './sit-down-repository';

type WriteOperation = 'save-draft' | 'stand-up';

type RepositoryOptions = {
	readonly factory: IDBFactory;
	readonly now?: () => Date;
	readonly beforeCommit?: (operation: WriteOperation, transaction: IDBTransaction) => void;
};

function repositoryError(error: unknown): SitDownRepositoryError {
	if (error instanceof SitDownRepositoryError) return error;
	if (error instanceof Error && error.name === 'ConfigurationRepositoryError') {
		return new SitDownRepositoryError('corrupt-data', error.message);
	}
	return new SitDownRepositoryError(
		'storage-failed',
		error instanceof Error ? error.message : 'Local sit-down storage failed unexpectedly.'
	);
}

function validateRelationships(snapshot: SitDownSnapshot, expectedDraft: boolean): void {
	if (snapshot.session.isDraft !== expectedDraft) {
		throw new SitDownRepositoryError(
			'invalid-session',
			expectedDraft
				? 'A draft save requires an unfinished sit-down.'
				: 'Standing up requires a completed sit-down snapshot.'
		);
	}

	const accountIds = new Set<string>();
	for (const record of snapshot.accountRecords) {
		if (record.sessionId !== snapshot.session.id) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'Every account snapshot must belong to the sit-down session.'
			);
		}
		if (accountIds.has(record.accountId)) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'A sit-down cannot contain duplicate account snapshots.'
			);
		}
		accountIds.add(record.accountId);
	}

	const liabilityIds = new Set<string>();
	for (const payment of snapshot.paymentRecords) {
		if (payment.sessionId !== snapshot.session.id) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'Every payment must belong to the sit-down session.'
			);
		}
		if (!accountIds.has(payment.liabilityAccountId)) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'Every payment liability must have an account snapshot.'
			);
		}
		if (
			payment.sourceAssetAccountId !== undefined &&
			!accountIds.has(payment.sourceAssetAccountId)
		) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'Every selected source asset must have an account snapshot.'
			);
		}
		if (liabilityIds.has(payment.liabilityAccountId)) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'A sit-down cannot contain duplicate liability payments.'
			);
		}
		liabilityIds.add(payment.liabilityAccountId);
	}
}

export class IndexedDbSitDownRepository implements SitDownRepository {
	readonly #factory: IDBFactory;
	readonly #now: () => Date;
	readonly #beforeCommit?: RepositoryOptions['beforeCommit'];
	#databasePromise: Promise<IDBDatabase> | null = null;
	#writeQueue: Promise<void> = Promise.resolve();

	constructor(options: RepositoryOptions) {
		this.#factory = options.factory;
		this.#now = options.now ?? (() => new Date());
		this.#beforeCommit = options.beforeCommit;
	}

	async loadLatestSession(): Promise<SitDownSnapshot | null> {
		try {
			const database = await this.#getDatabase();
			const sessionTransaction = database.transaction(SESSIONS_STORE, 'readonly');
			const sessionCompleted = transactionCompleted(sessionTransaction);
			const rawSessions = await requestResult(
				sessionTransaction.objectStore(SESSIONS_STORE).index(SESSION_UPDATED_AT_INDEX).getAll()
			);
			await sessionCompleted;
			const latest = (rawSessions as unknown[])
				.map(parseStoredSession)
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

			const snapshot: SitDownSnapshot = latest.isDraft
				? {
						session: { ...latest, isDraft: true },
						accountRecords: (rawAccountRecords as unknown[]).map(parseStoredDraftAccountRecord),
						paymentRecords: (rawPaymentRecords as unknown[]).map(parseStoredDraftPaymentRecord)
					}
				: {
						session: { ...latest, isDraft: false },
						accountRecords: (rawAccountRecords as unknown[]).map(parseStoredAccountRecord),
						paymentRecords: (rawPaymentRecords as unknown[]).map(parseStoredPaymentRecord)
					};
			validateRelationships(snapshot, latest.isDraft);
			return snapshot;
		} catch (error) {
			throw repositoryError(error);
		}
	}

	saveDraft(snapshot: SitDownDraftSnapshot): Promise<SitDownDraftSnapshot> {
		validateRelationships(snapshot, true);
		return this.#enqueueWrite(() => this.#writeSnapshot(snapshot, 'save-draft'));
	}

	standUp(snapshot: StoodUpSitDownSnapshot): Promise<StoodUpSitDownSnapshot> {
		validateRelationships(snapshot, false);
		return this.#enqueueWrite(() => this.#writeSnapshot(snapshot, 'stand-up'));
	}

	async #writeSnapshot(
		snapshot: SitDownDraftSnapshot,
		operation: 'save-draft'
	): Promise<SitDownDraftSnapshot>;
	async #writeSnapshot(
		snapshot: StoodUpSitDownSnapshot,
		operation: 'stand-up'
	): Promise<StoodUpSitDownSnapshot>;
	async #writeSnapshot(
		snapshot: SitDownSnapshot,
		operation: WriteOperation
	): Promise<SitDownSnapshot> {
		try {
			const database = await this.#getDatabase();
			const timestamp = this.#timestamp();
			const saved = {
				session: { ...snapshot.session, updatedAt: timestamp },
				accountRecords: snapshot.accountRecords.map((record) => ({
					...record,
					updatedAt: timestamp
				})),
				paymentRecords: snapshot.paymentRecords.map((record) => ({
					...record,
					updatedAt: timestamp
				}))
			} as SitDownSnapshot;
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
				'readwrite'
			);
			const completed = transactionCompleted(transaction);
			try {
				const sessionStore = transaction.objectStore(SESSIONS_STORE);
				const accountStore = transaction.objectStore(ACCOUNT_RECORDS_STORE);
				const paymentStore = transaction.objectStore(PAYMENT_RECORDS_STORE);
				const [existingAccountRecords, existingPaymentRecords] = await Promise.all([
					requestResult(
						accountStore.index(ACCOUNT_RECORD_SESSION_INDEX).getAll(snapshot.session.id)
					),
					requestResult(
						paymentStore.index(PAYMENT_RECORD_SESSION_INDEX).getAll(snapshot.session.id)
					)
				]);
				const nextAccountRecordIds = new Set<string>(
					saved.accountRecords.map((record) => record.id)
				);
				const nextPaymentRecordIds = new Set<string>(
					saved.paymentRecords.map((record) => record.id)
				);
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
				this.#beforeCommit?.(operation, transaction);
				await Promise.all([Promise.all(requests), completed]);
				return saved;
			} catch (error) {
				try {
					transaction.abort();
				} catch {
					// The transaction may already have aborted or completed.
				}
				throw error;
			}
		} catch (error) {
			throw repositoryError(error);
		}
	}

	#enqueueWrite<Value>(operation: () => Promise<Value>): Promise<Value> {
		const result = this.#writeQueue.catch(() => undefined).then(operation);
		this.#writeQueue = result.then(
			() => undefined,
			() => undefined
		);
		return result;
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

export function createBrowserSitDownRepository(): IndexedDbSitDownRepository {
	if (typeof indexedDB === 'undefined') {
		throw new SitDownRepositoryError(
			'storage-unavailable',
			'IndexedDB is unavailable in this browser.'
		);
	}
	return new IndexedDbSitDownRepository({ factory: indexedDB });
}

export { STASHY_DATABASE_VERSION };
