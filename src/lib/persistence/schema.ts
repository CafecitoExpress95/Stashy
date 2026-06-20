import { appSettingsIdFromString } from '$lib/domain';

export const STASHY_DATABASE_NAME = 'stashy';
export const STASHY_DATABASE_VERSION = 1;
export const APP_SETTINGS_STORE = 'appSettings';
export const ACCOUNTS_STORE = 'accounts';
export const APP_SETTINGS_ID = appSettingsIdFromString('00000000-0000-4000-8000-000000000001');

export type StashyStoreName = typeof APP_SETTINGS_STORE | typeof ACCOUNTS_STORE;

type DatabaseMigration = {
	readonly version: number;
	readonly upgrade: (database: IDBDatabase) => void;
};

const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
	{
		version: 1,
		upgrade(database) {
			database.createObjectStore(APP_SETTINGS_STORE, { keyPath: 'id' });
			database.createObjectStore(ACCOUNTS_STORE, { keyPath: 'id' });
		}
	}
];

export function applyDatabaseMigrations(
	database: IDBDatabase,
	oldVersion: number,
	newVersion: number
): void {
	for (const migration of DATABASE_MIGRATIONS) {
		if (migration.version > oldVersion && migration.version <= newVersion) {
			migration.upgrade(database);
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
