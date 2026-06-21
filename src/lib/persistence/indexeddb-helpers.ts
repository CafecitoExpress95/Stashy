import { STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION, applyDatabaseMigrations } from './schema';

export function requestResult<Value>(request: IDBRequest<Value>): Promise<Value> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
	});
}

export function transactionCompleted(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
	});
}

export function openStashyDatabase(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		let request: IDBOpenDBRequest;
		try {
			request = factory.open(STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION);
		} catch (error) {
			reject(error);
			return;
		}
		request.onupgradeneeded = (event) => {
			applyDatabaseMigrations(
				request.result,
				event.oldVersion,
				event.newVersion ?? STASHY_DATABASE_VERSION
			);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Could not open Stashy storage.'));
		request.onblocked = () =>
			reject(new Error('Close other Stashy tabs before upgrading local storage.'));
	});
}
