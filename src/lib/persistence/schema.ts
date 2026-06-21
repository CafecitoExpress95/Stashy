import { appSettingsIdFromString } from '$lib/domain';

export const STASHY_DATABASE_NAME = 'stashy';
export const STASHY_DATABASE_VERSION = 3;
export const APP_SETTINGS_STORE = 'appSettings';
export const ACCOUNTS_STORE = 'accounts';
export const SESSIONS_STORE = 'sessions';
export const ACCOUNT_RECORDS_STORE = 'accountRecords';
export const PAYMENT_RECORDS_STORE = 'paymentRecords';
export const AUDIT_ENTRIES_STORE = 'auditEntries';
export const SESSION_SIT_DOWN_DATE_INDEX = 'sitDownDate';
export const SESSION_UPDATED_AT_INDEX = 'updatedAt';
export const SESSION_DRAFT_INDEX = 'isDraft';
export const ACCOUNT_RECORD_SESSION_INDEX = 'sessionId';
export const ACCOUNT_RECORD_ACCOUNT_INDEX = 'accountId';
export const PAYMENT_RECORD_SESSION_INDEX = 'sessionId';
export const PAYMENT_RECORD_LIABILITY_INDEX = 'liabilityAccountId';
export const PAYMENT_RECORD_SOURCE_INDEX = 'sourceAssetAccountId';
export const AUDIT_ENTRY_ENTITY_TYPE_INDEX = 'entityType';
export const AUDIT_ENTRY_ENTITY_ID_INDEX = 'entityId';
export const AUDIT_ENTRY_UPDATED_AT_INDEX = 'updatedAt';
export const APP_SETTINGS_ID = appSettingsIdFromString('00000000-0000-4000-8000-000000000001');

export type StashyStoreName =
	| typeof APP_SETTINGS_STORE
	| typeof ACCOUNTS_STORE
	| typeof SESSIONS_STORE
	| typeof ACCOUNT_RECORDS_STORE
	| typeof PAYMENT_RECORDS_STORE
	| typeof AUDIT_ENTRIES_STORE;

type DatabaseMigration = {
	readonly version: number;
	readonly upgrade: (database: IDBDatabase, transaction: IDBTransaction) => void;
};

const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
	{
		version: 1,
		upgrade(database) {
			database.createObjectStore(APP_SETTINGS_STORE, { keyPath: 'id' });
			database.createObjectStore(ACCOUNTS_STORE, { keyPath: 'id' });
		}
	},
	{
		version: 2,
		upgrade(database) {
			const sessions = database.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
			sessions.createIndex(SESSION_SIT_DOWN_DATE_INDEX, 'sitDownDate');
			sessions.createIndex(SESSION_UPDATED_AT_INDEX, 'updatedAt');
			sessions.createIndex(SESSION_DRAFT_INDEX, 'isDraft');

			const accountRecords = database.createObjectStore(ACCOUNT_RECORDS_STORE, {
				keyPath: 'id'
			});
			accountRecords.createIndex(ACCOUNT_RECORD_SESSION_INDEX, 'sessionId');
			accountRecords.createIndex(ACCOUNT_RECORD_ACCOUNT_INDEX, 'accountId');

			const paymentRecords = database.createObjectStore(PAYMENT_RECORDS_STORE, {
				keyPath: 'id'
			});
			paymentRecords.createIndex(PAYMENT_RECORD_SESSION_INDEX, 'sessionId');
			paymentRecords.createIndex(PAYMENT_RECORD_LIABILITY_INDEX, 'liabilityAccountId');
			paymentRecords.createIndex(PAYMENT_RECORD_SOURCE_INDEX, 'sourceAssetAccountId');
		}
	},
	{
		version: 3,
		upgrade(database, transaction) {
			const sessions = transaction.objectStore(SESSIONS_STORE);
			if (sessions.indexNames.contains(SESSION_DRAFT_INDEX)) {
				sessions.deleteIndex(SESSION_DRAFT_INDEX);
			}

			const auditEntries = database.createObjectStore(AUDIT_ENTRIES_STORE, { keyPath: 'id' });
			auditEntries.createIndex(AUDIT_ENTRY_ENTITY_TYPE_INDEX, 'entityType');
			auditEntries.createIndex(AUDIT_ENTRY_ENTITY_ID_INDEX, 'entityId');
			auditEntries.createIndex(AUDIT_ENTRY_UPDATED_AT_INDEX, 'updatedAt');
		}
	}
];

export function applyDatabaseMigrations(
	database: IDBDatabase,
	transaction: IDBTransaction,
	oldVersion: number,
	newVersion: number
): void {
	for (const migration of DATABASE_MIGRATIONS) {
		if (migration.version > oldVersion && migration.version <= newVersion) {
			migration.upgrade(database, transaction);
		}
	}
}

export function deleteStashyDatabase(factory: IDBFactory): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = factory.deleteDatabase(STASHY_DATABASE_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error ?? new Error('Could not reset Stashy storage.'));
		request.onblocked = () =>
			reject(new Error('Close other Stashy tabs before resetting storage.'));
	});
}
