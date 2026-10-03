import packageMetadata from '../../../package.json';
import type {
	AccountRecord,
	DraftAccountRecord,
	DraftPaymentRecord,
	PaymentRecord,
	Session
} from '$lib/domain';
import { IndexedDbConfigurationRepository } from './indexeddb-configuration-repository';
import { openStashyDatabase, requestResult, transactionCompleted } from './indexeddb-helpers';
import {
	parseStoredAuditEntry,
	parseStoredDraftAccountRecord,
	parseStoredDraftPaymentRecord,
	parseStoredAccountRecord,
	parseStoredPaymentRecord,
	parseStoredSession
} from './records';
import {
	ACCOUNTS_STORE,
	ACCOUNT_RECORDS_STORE,
	APP_SETTINGS_STORE,
	AUDIT_ENTRIES_STORE,
	PAYMENT_RECORDS_STORE,
	SESSIONS_STORE,
	type StashyStoreName
} from './schema';
import { countStashyArchiveData, createStashyArchive } from './stashy-archive-export';
import type {
	StashyArchiveCounts,
	StashyArchiveData,
	StashyArchiveExport,
	StashyArchiveImport,
	StashyArchiveValidationResult
} from './stashy-archive-types';
import { validateStashyArchive } from './stashy-archive-validate';

const ALL_STORES: readonly StashyStoreName[] = [
	APP_SETTINGS_STORE,
	ACCOUNTS_STORE,
	SESSIONS_STORE,
	ACCOUNT_RECORDS_STORE,
	PAYMENT_RECORDS_STORE,
	AUDIT_ENTRIES_STORE
];

export type DataPortabilityErrorCode = 'storage-unavailable' | 'storage-failed' | 'invalid-archive';

export class DataPortabilityError extends Error {
	readonly code: DataPortabilityErrorCode;

	constructor(code: DataPortabilityErrorCode, message: string) {
		super(message);
		this.name = 'DataPortabilityError';
		this.code = code;
	}
}

type PortabilityOptions = {
	readonly factory: IDBFactory;
	readonly appVersion?: string;
	readonly now?: () => Date;
	readonly beforeCommit?: (transaction: IDBTransaction) => void;
};

function portabilityError(error: unknown): DataPortabilityError {
	if (error instanceof DataPortabilityError) return error;
	return new DataPortabilityError(
		'storage-failed',
		error instanceof Error ? error.message : 'Local backup storage failed unexpectedly.'
	);
}

function rawSessionId(value: unknown): string | null {
	return typeof value === 'object' && value !== null && 'sessionId' in value
		? String(value.sessionId)
		: null;
}

export class IndexedDbDataPortabilityService {
	readonly #factory: IDBFactory;
	readonly #appVersion: string;
	readonly #now: () => Date;
	readonly #beforeCommit?: PortabilityOptions['beforeCommit'];
	#databasePromise: Promise<IDBDatabase> | null = null;

	constructor(options: PortabilityOptions) {
		this.#factory = options.factory;
		this.#appVersion = options.appVersion ?? packageMetadata.version;
		this.#now = options.now ?? (() => new Date());
		this.#beforeCommit = options.beforeCommit;
	}

	async getLocalCounts(): Promise<StashyArchiveCounts> {
		return countStashyArchiveData(await this.#readData());
	}

	async exportArchive(): Promise<StashyArchiveExport> {
		try {
			const archive = createStashyArchive(await this.#readData(), {
				appVersion: this.#appVersion,
				now: this.#now()
			});
			const validation = validateStashyArchive(archive.bytes);
			if (!validation.ok) {
				throw new DataPortabilityError(
					'invalid-archive',
					`Stashy could not verify the new backup: ${validation.errors.join(' ')}`
				);
			}
			return archive;
		} catch (error) {
			throw portabilityError(error);
		}
	}

	validateArchive(bytes: Uint8Array): StashyArchiveValidationResult {
		return validateStashyArchive(bytes);
	}

	async restoreArchive(archive: StashyArchiveImport): Promise<void> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction([...ALL_STORES], 'readwrite');
			const completed = transactionCompleted(transaction);
			const requests: Array<Promise<unknown>> = [];
			try {
				// IndexedDB queues requests in order; enqueue replacement before yielding.
				for (const storeName of ALL_STORES) {
					requests.push(requestResult(transaction.objectStore(storeName).clear()));
				}

				requests.push(
					requestResult(transaction.objectStore(APP_SETTINGS_STORE).put(archive.data.settings))
				);
				for (const account of archive.data.accounts) {
					requests.push(requestResult(transaction.objectStore(ACCOUNTS_STORE).put(account)));
				}
				for (const session of archive.data.sessions) {
					requests.push(requestResult(transaction.objectStore(SESSIONS_STORE).put(session)));
				}
				for (const record of archive.data.accountRecords) {
					requests.push(requestResult(transaction.objectStore(ACCOUNT_RECORDS_STORE).put(record)));
				}
				for (const record of archive.data.paymentRecords) {
					requests.push(requestResult(transaction.objectStore(PAYMENT_RECORDS_STORE).put(record)));
				}
				for (const audit of archive.data.auditEntries) {
					requests.push(requestResult(transaction.objectStore(AUDIT_ENTRIES_STORE).put(audit)));
				}
				this.#beforeCommit?.(transaction);
				await Promise.all([...requests, completed]);
			} catch (error) {
				try {
					transaction.abort();
				} catch {
					// The transaction may already have aborted or completed.
				}
				// A synchronous put failure can leave earlier requests pending until abort.
				await Promise.allSettled([...requests, completed]);
				throw error;
			}
		} catch (error) {
			throw portabilityError(error);
		}
	}

	async #readData(): Promise<StashyArchiveData> {
		try {
			const configuration = await new IndexedDbConfigurationRepository({
				factory: this.#factory,
				now: this.#now
			}).loadConfiguration();
			const database = await this.#getDatabase();
			const transaction = database.transaction(
				[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE, AUDIT_ENTRIES_STORE],
				'readonly'
			);
			const completed = transactionCompleted(transaction);
			const [rawSessions, rawAccountRecords, rawPaymentRecords, rawAudits] = await Promise.all([
				requestResult(transaction.objectStore(SESSIONS_STORE).getAll()),
				requestResult(transaction.objectStore(ACCOUNT_RECORDS_STORE).getAll()),
				requestResult(transaction.objectStore(PAYMENT_RECORDS_STORE).getAll()),
				requestResult(transaction.objectStore(AUDIT_ENTRIES_STORE).getAll())
			]);
			await completed;

			const sessions = (rawSessions as unknown[]).map(parseStoredSession);
			const sessionsById = new Map<string, Session>(
				sessions.map((session) => [session.id, session])
			);
			const accountRecords: Array<DraftAccountRecord | AccountRecord> = (
				rawAccountRecords as unknown[]
			).map((raw) => {
				const session = sessionsById.get(rawSessionId(raw) ?? '');
				if (!session) throw new Error('Stored account record references a missing session.');
				return session.isDraft ? parseStoredDraftAccountRecord(raw) : parseStoredAccountRecord(raw);
			});
			const paymentRecords: Array<DraftPaymentRecord | PaymentRecord> = (
				rawPaymentRecords as unknown[]
			).map((raw) => {
				const session = sessionsById.get(rawSessionId(raw) ?? '');
				if (!session) throw new Error('Stored payment record references a missing session.');
				return session.isDraft ? parseStoredDraftPaymentRecord(raw) : parseStoredPaymentRecord(raw);
			});

			return {
				settings: configuration.settings,
				accounts: configuration.accounts,
				sessions,
				accountRecords,
				paymentRecords,
				auditEntries: (rawAudits as unknown[]).map(parseStoredAuditEntry)
			};
		} catch (error) {
			throw portabilityError(error);
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
}

export function createBrowserDataPortabilityService(): IndexedDbDataPortabilityService {
	if (typeof indexedDB === 'undefined') {
		throw new DataPortabilityError(
			'storage-unavailable',
			'IndexedDB is unavailable in this browser.'
		);
	}
	return new IndexedDbDataPortabilityService({ factory: indexedDB });
}
