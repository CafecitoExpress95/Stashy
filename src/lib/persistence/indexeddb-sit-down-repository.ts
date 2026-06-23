import {
	auditEntryIdFromString,
	isoTimestampFromString,
	type AccountRecord,
	type AuditEntry,
	type IsoTimestamp,
	type PaymentRecord,
	type Session,
	type SessionId
} from '$lib/domain';
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
	AUDIT_ENTRIES_STORE,
	PAYMENT_RECORDS_STORE,
	PAYMENT_RECORD_SESSION_INDEX,
	SESSIONS_STORE,
	STASHY_DATABASE_VERSION
} from './schema';
import {
	SitDownRepositoryError,
	type SitDownDraftSnapshot,
	type SitDownRepository,
	type SitDownSnapshot,
	type StoodUpCorrectionResult,
	type StoodUpSitDownSnapshot
} from './sit-down-repository';

type WriteOperation = 'save-draft' | 'stand-up' | 'save-correction' | 'discard-draft';

type RepositoryOptions = {
	readonly factory: IDBFactory;
	readonly now?: () => Date;
	readonly randomUUID?: () => string;
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

function compareSessionsNewestFirst(left: Session, right: Session): number {
	return (
		right.sitDownDate.localeCompare(left.sitDownDate) ||
		right.createdAt.localeCompare(left.createdAt) ||
		right.id.localeCompare(left.id)
	);
}

function accountRecordSemanticallyEqual(left: AccountRecord, right: AccountRecord): boolean {
	return (
		left.id === right.id &&
		left.sessionId === right.sessionId &&
		left.accountId === right.accountId &&
		left.openingBalance === right.openingBalance &&
		left.finalBalance === right.finalBalance &&
		left.openingStatementBalance === right.openingStatementBalance &&
		left.finalStatementBalance === right.finalStatementBalance
	);
}

function paymentRecordSemanticallyEqual(left: PaymentRecord, right: PaymentRecord): boolean {
	return (
		left.id === right.id &&
		left.sessionId === right.sessionId &&
		left.liabilityAccountId === right.liabilityAccountId &&
		left.sourceAssetAccountId === right.sourceAssetAccountId &&
		left.paymentMode === right.paymentMode &&
		left.paymentAmount === right.paymentAmount &&
		left.startingAccountBalance === right.startingAccountBalance &&
		left.startingStatementBalance === right.startingStatementBalance &&
		left.remainingAccountBalance === right.remainingAccountBalance &&
		left.remainingStatementBalance === right.remainingStatementBalance &&
		left.confirmationId === right.confirmationId &&
		left.notes === right.notes
	);
}

function validateCorrectionShape(
	existing: StoodUpSitDownSnapshot,
	next: StoodUpSitDownSnapshot
): void {
	if (existing.session.id !== next.session.id) {
		throw new SitDownRepositoryError(
			'invalid-session',
			'A correction must preserve the session ID.'
		);
	}
	const existingAccounts = new Map(existing.accountRecords.map((record) => [record.id, record]));
	const existingPayments = new Map(existing.paymentRecords.map((record) => [record.id, record]));
	if (
		existingAccounts.size !== next.accountRecords.length ||
		existingPayments.size !== next.paymentRecords.length
	) {
		throw new SitDownRepositoryError(
			'invalid-session',
			'A correction cannot add or remove historical records.'
		);
	}
	for (const record of next.accountRecords) {
		const prior = existingAccounts.get(record.id);
		if (!prior || prior.sessionId !== record.sessionId || prior.accountId !== record.accountId) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'A correction must preserve account-record IDs and ownership.'
			);
		}
	}
	for (const payment of next.paymentRecords) {
		const prior = existingPayments.get(payment.id);
		if (
			!prior ||
			prior.sessionId !== payment.sessionId ||
			prior.liabilityAccountId !== payment.liabilityAccountId
		) {
			throw new SitDownRepositoryError(
				'invalid-session',
				'A correction must preserve payment-record IDs and liability ownership.'
			);
		}
	}
}

function stoodUpSnapshotsSemanticallyEqual(
	left: StoodUpSitDownSnapshot,
	right: StoodUpSitDownSnapshot
): boolean {
	if (
		left.session.id !== right.session.id ||
		left.session.sitDownDate !== right.session.sitDownDate ||
		left.accountRecords.length !== right.accountRecords.length ||
		left.paymentRecords.length !== right.paymentRecords.length
	) {
		return false;
	}
	const rightAccounts = new Map(right.accountRecords.map((record) => [record.id, record]));
	const rightPayments = new Map(right.paymentRecords.map((record) => [record.id, record]));
	return (
		left.accountRecords.every((record) => {
			const candidate = rightAccounts.get(record.id);
			return candidate !== undefined && accountRecordSemanticallyEqual(record, candidate);
		}) &&
		left.paymentRecords.every((record) => {
			const candidate = rightPayments.get(record.id);
			return candidate !== undefined && paymentRecordSemanticallyEqual(record, candidate);
		})
	);
}

function rawSessionId(value: unknown): string {
	return typeof value === 'object' && value !== null && 'sessionId' in value
		? String(value.sessionId)
		: '';
}

function buildSnapshot(
	session: Session,
	rawAccountRecords: readonly unknown[],
	rawPaymentRecords: readonly unknown[]
): SitDownSnapshot {
	const snapshot: SitDownSnapshot = session.isDraft
		? {
				session: { ...session, isDraft: true },
				accountRecords: rawAccountRecords.map(parseStoredDraftAccountRecord),
				paymentRecords: rawPaymentRecords.map(parseStoredDraftPaymentRecord)
			}
		: {
				session: { ...session, isDraft: false },
				accountRecords: rawAccountRecords.map(parseStoredAccountRecord),
				paymentRecords: rawPaymentRecords.map(parseStoredPaymentRecord)
			};
	validateRelationships(snapshot, session.isDraft);
	return snapshot;
}

export class IndexedDbSitDownRepository implements SitDownRepository {
	readonly #factory: IDBFactory;
	readonly #now: () => Date;
	readonly #randomUUID: () => string;
	readonly #beforeCommit?: RepositoryOptions['beforeCommit'];
	#databasePromise: Promise<IDBDatabase> | null = null;
	#writeQueue: Promise<void> = Promise.resolve();

	constructor(options: RepositoryOptions) {
		this.#factory = options.factory;
		this.#now = options.now ?? (() => new Date());
		this.#randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
		this.#beforeCommit = options.beforeCommit;
	}

	async listSessions(): Promise<readonly SitDownSnapshot[]> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
				'readonly'
			);
			const completed = transactionCompleted(transaction);
			const [rawSessions, rawAccountRecords, rawPaymentRecords] = await Promise.all([
				requestResult(transaction.objectStore(SESSIONS_STORE).getAll()),
				requestResult(transaction.objectStore(ACCOUNT_RECORDS_STORE).getAll()),
				requestResult(transaction.objectStore(PAYMENT_RECORDS_STORE).getAll())
			]);
			await completed;
			return (rawSessions as unknown[])
				.map(parseStoredSession)
				.sort(compareSessionsNewestFirst)
				.map((session) =>
					buildSnapshot(
						session,
						(rawAccountRecords as unknown[]).filter(
							(record) => rawSessionId(record) === session.id
						),
						(rawPaymentRecords as unknown[]).filter((record) => rawSessionId(record) === session.id)
					)
				);
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async loadSession(sessionId: SessionId): Promise<SitDownSnapshot | null> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
				'readonly'
			);
			const completed = transactionCompleted(transaction);
			const rawSession = await requestResult(
				transaction.objectStore(SESSIONS_STORE).get(sessionId)
			);
			if (rawSession === undefined) {
				await completed;
				return null;
			}
			const [rawAccountRecords, rawPaymentRecords] = await Promise.all([
				requestResult(
					transaction
						.objectStore(ACCOUNT_RECORDS_STORE)
						.index(ACCOUNT_RECORD_SESSION_INDEX)
						.getAll(sessionId)
				),
				requestResult(
					transaction
						.objectStore(PAYMENT_RECORDS_STORE)
						.index(PAYMENT_RECORD_SESSION_INDEX)
						.getAll(sessionId)
				)
			]);
			await completed;
			return buildSnapshot(
				parseStoredSession(rawSession),
				rawAccountRecords as unknown[],
				rawPaymentRecords as unknown[]
			);
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async loadLatestSession(): Promise<SitDownSnapshot | null> {
		return (await this.listSessions())[0] ?? null;
	}

	saveDraft(snapshot: SitDownDraftSnapshot): Promise<SitDownDraftSnapshot> {
		validateRelationships(snapshot, true);
		return this.#enqueueWrite(() => this.#writeSnapshot(snapshot, 'save-draft'));
	}

	standUp(snapshot: StoodUpSitDownSnapshot): Promise<StoodUpSitDownSnapshot> {
		validateRelationships(snapshot, false);
		return this.#enqueueWrite(() => this.#writeSnapshot(snapshot, 'stand-up'));
	}

	saveStoodUpCorrection(snapshot: StoodUpSitDownSnapshot): Promise<StoodUpCorrectionResult> {
		validateRelationships(snapshot, false);
		return this.#enqueueWrite(() => this.#saveCorrection(snapshot));
	}

	discardDraft(sessionId: SessionId): Promise<void> {
		return this.#enqueueWrite(() => this.#discardDraft(sessionId));
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
		operation: 'save-draft' | 'stand-up'
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
				const [existingSession, existingAccountRecords, existingPaymentRecords] = await Promise.all(
					[
						requestResult(sessionStore.get(snapshot.session.id)),
						requestResult(
							accountStore.index(ACCOUNT_RECORD_SESSION_INDEX).getAll(snapshot.session.id)
						),
						requestResult(
							paymentStore.index(PAYMENT_RECORD_SESSION_INDEX).getAll(snapshot.session.id)
						)
					]
				);
				if (operation === 'save-draft' && existingSession !== undefined) {
					const prior = parseStoredSession(existingSession);
					if (!prior.isDraft) {
						throw new SitDownRepositoryError(
							'invalid-session',
							'A stood-up session cannot be changed back into a draft.'
						);
					}
				}
				if (operation === 'stand-up' && existingSession !== undefined) {
					const priorSession = parseStoredSession(existingSession);
					if (!priorSession.isDraft) {
						const priorSnapshot = buildSnapshot(
							priorSession,
							existingAccountRecords as unknown[],
							existingPaymentRecords as unknown[]
						) as StoodUpSitDownSnapshot;
						if (
							!stoodUpSnapshotsSemanticallyEqual(priorSnapshot, snapshot as StoodUpSitDownSnapshot)
						) {
							throw new SitDownRepositoryError(
								'invalid-session',
								'Changes to a stood-up session must use the audited correction workflow.'
							);
						}
					}
				}
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
				await completed.catch(() => undefined);
				throw error;
			}
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async #discardDraft(sessionId: SessionId): Promise<void> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
				'readwrite'
			);
			const completed = transactionCompleted(transaction);
			try {
				const sessionStore = transaction.objectStore(SESSIONS_STORE);
				const accountStore = transaction.objectStore(ACCOUNT_RECORDS_STORE);
				const paymentStore = transaction.objectStore(PAYMENT_RECORDS_STORE);
				const [rawSession, rawAccountRecords, rawPaymentRecords] = await Promise.all([
					requestResult(sessionStore.get(sessionId)),
					requestResult(accountStore.index(ACCOUNT_RECORD_SESSION_INDEX).getAll(sessionId)),
					requestResult(paymentStore.index(PAYMENT_RECORD_SESSION_INDEX).getAll(sessionId))
				]);
				if (rawSession === undefined) {
					await completed;
					return;
				}
				const session = parseStoredSession(rawSession);
				if (!session.isDraft) {
					throw new SitDownRepositoryError(
						'invalid-session',
						'Only unfinished drafts can be discarded.'
					);
				}
				const requests: Array<Promise<unknown>> = [requestResult(sessionStore.delete(sessionId))];
				for (const raw of rawAccountRecords as Array<{ id: string }>) {
					requests.push(requestResult(accountStore.delete(raw.id)));
				}
				for (const raw of rawPaymentRecords as Array<{ id: string }>) {
					requests.push(requestResult(paymentStore.delete(raw.id)));
				}
				this.#beforeCommit?.('discard-draft', transaction);
				await Promise.all([Promise.all(requests), completed]);
			} catch (error) {
				try {
					transaction.abort();
				} catch {
					// The transaction may already have aborted or completed.
				}
				await completed.catch(() => undefined);
				throw error;
			}
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async #saveCorrection(next: StoodUpSitDownSnapshot): Promise<StoodUpCorrectionResult> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE, AUDIT_ENTRIES_STORE],
				'readwrite'
			);
			const completed = transactionCompleted(transaction);
			try {
				const sessionStore = transaction.objectStore(SESSIONS_STORE);
				const accountStore = transaction.objectStore(ACCOUNT_RECORDS_STORE);
				const paymentStore = transaction.objectStore(PAYMENT_RECORDS_STORE);
				const auditStore = transaction.objectStore(AUDIT_ENTRIES_STORE);
				const [rawSession, rawAccountRecords, rawPaymentRecords] = await Promise.all([
					requestResult(sessionStore.get(next.session.id)),
					requestResult(accountStore.index(ACCOUNT_RECORD_SESSION_INDEX).getAll(next.session.id)),
					requestResult(paymentStore.index(PAYMENT_RECORD_SESSION_INDEX).getAll(next.session.id))
				]);
				if (rawSession === undefined) {
					throw new SitDownRepositoryError(
						'invalid-session',
						'The session to correct no longer exists.'
					);
				}
				const loaded = buildSnapshot(
					parseStoredSession(rawSession),
					rawAccountRecords as unknown[],
					rawPaymentRecords as unknown[]
				);
				if (loaded.session.isDraft) {
					throw new SitDownRepositoryError(
						'invalid-session',
						'Draft changes must use the draft save workflow.'
					);
				}
				const existing = loaded as StoodUpSitDownSnapshot;
				validateCorrectionShape(existing, next);

				const sessionChanged = existing.session.sitDownDate !== next.session.sitDownDate;
				const nextAccountsById = new Map(next.accountRecords.map((record) => [record.id, record]));
				const nextPaymentsById = new Map(next.paymentRecords.map((record) => [record.id, record]));
				const changedAccountIds = new Set(
					existing.accountRecords
						.filter(
							(record) => !accountRecordSemanticallyEqual(record, nextAccountsById.get(record.id)!)
						)
						.map((record) => record.id)
				);
				const changedPaymentIds = new Set(
					existing.paymentRecords
						.filter(
							(record) => !paymentRecordSemanticallyEqual(record, nextPaymentsById.get(record.id)!)
						)
						.map((record) => record.id)
				);
				if (!sessionChanged && changedAccountIds.size === 0 && changedPaymentIds.size === 0) {
					await completed;
					return { snapshot: existing, auditEntries: [] };
				}

				const timestamp = this.#timestamp();
				const savedSession = {
					...next.session,
					isDraft: false as const,
					createdAt: existing.session.createdAt,
					updatedAt: timestamp
				};
				const savedAccounts = existing.accountRecords.map((prior) => {
					if (!changedAccountIds.has(prior.id)) return prior;
					return {
						...nextAccountsById.get(prior.id)!,
						createdAt: prior.createdAt,
						updatedAt: timestamp
					};
				});
				const savedPayments = existing.paymentRecords.map((prior) => {
					if (!changedPaymentIds.has(prior.id)) return prior;
					return {
						...nextPaymentsById.get(prior.id)!,
						createdAt: prior.createdAt,
						updatedAt: timestamp
					};
				});
				const saved: StoodUpSitDownSnapshot = {
					session: savedSession,
					accountRecords: savedAccounts,
					paymentRecords: savedPayments
				};
				const audits: AuditEntry[] = [];
				const auditCommon = () => ({
					id: auditEntryIdFromString(this.#randomUUID()),
					notes: null,
					createdAt: timestamp,
					updatedAt: timestamp
				});
				if (sessionChanged) {
					audits.push({
						...auditCommon(),
						entityType: 'session',
						entityId: existing.session.id,
						before: existing.session,
						after: savedSession
					});
				}
				for (const before of existing.accountRecords) {
					if (!changedAccountIds.has(before.id)) continue;
					const after = savedAccounts.find((record) => record.id === before.id)!;
					audits.push({
						...auditCommon(),
						entityType: 'account-record',
						entityId: before.id,
						before,
						after
					});
				}
				for (const before of existing.paymentRecords) {
					if (!changedPaymentIds.has(before.id)) continue;
					const after = savedPayments.find((record) => record.id === before.id)!;
					audits.push({
						...auditCommon(),
						entityType: 'payment-record',
						entityId: before.id,
						before,
						after
					});
				}

				const requests: Array<Promise<unknown>> = [requestResult(sessionStore.put(savedSession))];
				for (const record of savedAccounts) {
					if (changedAccountIds.has(record.id))
						requests.push(requestResult(accountStore.put(record)));
				}
				for (const record of savedPayments) {
					if (changedPaymentIds.has(record.id))
						requests.push(requestResult(paymentStore.put(record)));
				}
				for (const audit of audits) requests.push(requestResult(auditStore.add(audit)));
				this.#beforeCommit?.('save-correction', transaction);
				await Promise.all([Promise.all(requests), completed]);
				return { snapshot: saved, auditEntries: audits };
			} catch (error) {
				try {
					transaction.abort();
				} catch {
					// The transaction may already have aborted or completed.
				}
				await completed.catch(() => undefined);
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
	if (typeof crypto?.randomUUID !== 'function') {
		throw new SitDownRepositoryError(
			'storage-unavailable',
			'This browser cannot create stable audit IDs.'
		);
	}
	return new IndexedDbSitDownRepository({ factory: indexedDB });
}

export { STASHY_DATABASE_VERSION };
