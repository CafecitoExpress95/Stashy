import {
	accountIdFromString,
	findAdjacentActiveAccount,
	getNextAccountSortOrder,
	isoTimestampFromString,
	validateAccountName,
	validateAssetThresholdPolicy,
	validateAssetThresholds,
	type Account,
	type AccountId,
	type AccountMoveDirection,
	type AppSettings,
	type AssetThresholds,
	type IsoTimestamp
} from '$lib/domain';
import {
	ConfigurationRepositoryError,
	type ConfigurationRepository,
	type ConfigurationSnapshot,
	type CreateAccountInput,
	type UpdateAccountInput
} from './configuration-repository';
import { parseStoredAccount, parseStoredAccounts, parseStoredAppSettings } from './records';
import {
	ACCOUNTS_STORE,
	APP_SETTINGS_ID,
	APP_SETTINGS_STORE,
	STASHY_DATABASE_NAME,
	STASHY_DATABASE_VERSION,
	applyDatabaseMigrations
} from './schema';

type RepositoryOptions = {
	readonly factory: IDBFactory;
	readonly now?: () => Date;
	readonly randomUUID?: () => string;
};

function requestResult<Value>(request: IDBRequest<Value>): Promise<Value> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
	});
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
	});
}

function repositoryError(error: unknown): ConfigurationRepositoryError {
	return error instanceof ConfigurationRepositoryError
		? error
		: new ConfigurationRepositoryError(
				'storage-failed',
				error instanceof Error ? error.message : 'Local storage failed unexpectedly.'
			);
}

export class IndexedDbConfigurationRepository implements ConfigurationRepository {
	readonly #factory: IDBFactory;
	readonly #now: () => Date;
	readonly #randomUUID: () => string;
	#databasePromise: Promise<IDBDatabase> | null = null;

	constructor(options: RepositoryOptions) {
		this.#factory = options.factory;
		this.#now = options.now ?? (() => new Date());
		this.#randomUUID =
			options.randomUUID ??
			(() => {
				if (typeof globalThis.crypto?.randomUUID !== 'function') {
					throw new ConfigurationRepositoryError(
						'storage-unavailable',
						'This browser cannot create stable account IDs.'
					);
				}
				return globalThis.crypto.randomUUID();
			});
	}

	async loadConfiguration(): Promise<ConfigurationSnapshot> {
		try {
			const database = await this.#getDatabase();
			await this.#ensureSettings(database);
			const transaction = database.transaction([APP_SETTINGS_STORE, ACCOUNTS_STORE], 'readonly');
			const completed = transactionCompleted(transaction);
			const [rawSettings, rawAccounts] = await Promise.all([
				requestResult(transaction.objectStore(APP_SETTINGS_STORE).get(APP_SETTINGS_ID)),
				requestResult(transaction.objectStore(ACCOUNTS_STORE).getAll())
			]);
			await completed;
			return {
				settings: parseStoredAppSettings(rawSettings),
				accounts: parseStoredAccounts(rawAccounts as unknown[])
			};
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async createAccount(input: CreateAccountInput): Promise<Account> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(ACCOUNTS_STORE, 'readwrite');
			const completed = transactionCompleted(transaction);
			const store = transaction.objectStore(ACCOUNTS_STORE);
			const accounts = parseStoredAccounts((await requestResult(store.getAll())) as unknown[]);
			const nameValidation = validateAccountName(input.name, accounts);
			if (!nameValidation.ok) {
				await completed;
				throw new ConfigurationRepositoryError(
					nameValidation.issue.code,
					nameValidation.issue.message,
					nameValidation.issue.field
				);
			}

			const timestamp = this.#timestamp();
			const common = {
				id: this.#accountId(),
				name: nameValidation.value,
				archived: false,
				sortOrder: getNextAccountSortOrder(accounts, input.type),
				createdAt: timestamp,
				updatedAt: timestamp
			};
			const account: Account =
				input.type === 'asset'
					? {
							...common,
							type: 'asset',
							thresholdPolicy: input.thresholdPolicy ?? { mode: 'inherit' }
						}
					: { ...common, type: 'liability' };
			this.#validateAccount(account);
			await requestResult(store.add(account));
			await completed;
			return account;
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async updateAccount(accountId: AccountId, input: UpdateAccountInput): Promise<Account> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(ACCOUNTS_STORE, 'readwrite');
			const completed = transactionCompleted(transaction);
			const store = transaction.objectStore(ACCOUNTS_STORE);
			const accounts = parseStoredAccounts((await requestResult(store.getAll())) as unknown[]);
			const account = this.#requireAccount(accounts, accountId);
			const nameValidation = validateAccountName(input.name, accounts, accountId);
			if (!nameValidation.ok) {
				await completed;
				throw new ConfigurationRepositoryError(
					nameValidation.issue.code,
					nameValidation.issue.message,
					nameValidation.issue.field
				);
			}
			if (account.type === 'liability' && input.thresholdPolicy !== undefined) {
				await completed;
				throw new ConfigurationRepositoryError(
					'invalid-account-type',
					'Liability accounts cannot have asset thresholds.'
				);
			}

			const updated: Account =
				account.type === 'asset'
					? {
							...account,
							name: nameValidation.value,
							thresholdPolicy: input.thresholdPolicy ?? account.thresholdPolicy,
							updatedAt: this.#timestamp()
						}
					: { ...account, name: nameValidation.value, updatedAt: this.#timestamp() };
			this.#validateAccount(updated);
			await requestResult(store.put(updated));
			await completed;
			return updated;
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async setAccountArchived(accountId: AccountId, archived: boolean): Promise<Account> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(ACCOUNTS_STORE, 'readwrite');
			const completed = transactionCompleted(transaction);
			const store = transaction.objectStore(ACCOUNTS_STORE);
			const rawAccount = await requestResult(store.get(accountId));
			if (rawAccount === undefined) {
				await completed;
				throw new ConfigurationRepositoryError(
					'account-not-found',
					'That account no longer exists.'
				);
			}
			const account = parseStoredAccount(rawAccount);
			const updated = { ...account, archived, updatedAt: this.#timestamp() } satisfies Account;
			await requestResult(store.put(updated));
			await completed;
			return updated;
		} catch (error) {
			if (error instanceof ConfigurationRepositoryError) {
				throw error;
			}
			throw repositoryError(error);
		}
	}

	async moveAccount(
		accountId: AccountId,
		direction: AccountMoveDirection
	): Promise<readonly Account[]> {
		try {
			const database = await this.#getDatabase();
			const transaction = database.transaction(ACCOUNTS_STORE, 'readwrite');
			const completed = transactionCompleted(transaction);
			const store = transaction.objectStore(ACCOUNTS_STORE);
			const accounts = parseStoredAccounts((await requestResult(store.getAll())) as unknown[]);
			const account = this.#requireAccount(accounts, accountId);
			if (account.archived) {
				await completed;
				throw new ConfigurationRepositoryError(
					'archived-account-cannot-move',
					'Unarchive this account before changing its position.'
				);
			}
			const adjacent = findAdjacentActiveAccount(accounts, account, direction);
			if (!adjacent) {
				await completed;
				return accounts;
			}

			const timestamp = this.#timestamp();
			const moved = {
				...account,
				sortOrder: adjacent.sortOrder,
				updatedAt: timestamp
			} satisfies Account;
			const swapped = {
				...adjacent,
				sortOrder: account.sortOrder,
				updatedAt: timestamp
			} satisfies Account;
			await Promise.all([requestResult(store.put(moved)), requestResult(store.put(swapped))]);
			await completed;
			return accounts.map((candidate) =>
				candidate.id === moved.id ? moved : candidate.id === swapped.id ? swapped : candidate
			);
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async updateDefaultAssetThresholds(thresholds: AssetThresholds | null): Promise<AppSettings> {
		if (thresholds && !validateAssetThresholds(thresholds).ok) {
			throw new ConfigurationRepositoryError(
				'invalid-thresholds',
				'Danger must be lower than warning.',
				'dangerBelow'
			);
		}
		try {
			const database = await this.#getDatabase();
			await this.#ensureSettings(database);
			const transaction = database.transaction(APP_SETTINGS_STORE, 'readwrite');
			const completed = transactionCompleted(transaction);
			const store = transaction.objectStore(APP_SETTINGS_STORE);
			const settings = parseStoredAppSettings(await requestResult(store.get(APP_SETTINGS_ID)));
			const updated = {
				...settings,
				defaultAssetThresholds: thresholds,
				updatedAt: this.#timestamp()
			} satisfies AppSettings;
			await requestResult(store.put(updated));
			await completed;
			return updated;
		} catch (error) {
			throw repositoryError(error);
		}
	}

	async #getDatabase(): Promise<IDBDatabase> {
		this.#databasePromise ??= new Promise((resolve, reject) => {
			let request: IDBOpenDBRequest;
			try {
				request = this.#factory.open(STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION);
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
			request.onsuccess = () => {
				request.result.onversionchange = () => {
					request.result.close();
					this.#databasePromise = null;
				};
				resolve(request.result);
			};
			request.onerror = () => reject(request.error ?? new Error('Could not open Stashy storage.'));
			request.onblocked = () =>
				reject(new Error('Close other Stashy tabs before upgrading local storage.'));
		});
		return this.#databasePromise;
	}

	async #ensureSettings(database: IDBDatabase): Promise<void> {
		const transaction = database.transaction(APP_SETTINGS_STORE, 'readwrite');
		const completed = transactionCompleted(transaction);
		const store = transaction.objectStore(APP_SETTINGS_STORE);
		const existing = await requestResult(store.get(APP_SETTINGS_ID));
		if (existing === undefined) {
			const timestamp = this.#timestamp();
			const settings: AppSettings = {
				id: APP_SETTINGS_ID,
				schemaVersion: 1,
				currency: 'USD',
				defaultAssetThresholds: null,
				lastImportedAt: null,
				lastExportedAt: null,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await requestResult(store.add(settings));
		}
		await completed;
	}

	#requireAccount(accounts: readonly Account[], accountId: AccountId): Account {
		const account = accounts.find((candidate) => candidate.id === accountId);
		if (!account) {
			throw new ConfigurationRepositoryError('account-not-found', 'That account no longer exists.');
		}
		return account;
	}

	#validateAccount(account: Account): void {
		if (account.type === 'asset' && !validateAssetThresholdPolicy(account.thresholdPolicy)) {
			throw new ConfigurationRepositoryError(
				'invalid-thresholds',
				'Danger must be lower than warning.',
				'dangerBelow'
			);
		}
	}

	#timestamp(): IsoTimestamp {
		return isoTimestampFromString(this.#now().toISOString());
	}

	#accountId(): AccountId {
		try {
			return accountIdFromString(this.#randomUUID());
		} catch {
			throw new ConfigurationRepositoryError(
				'storage-unavailable',
				'This browser could not create a stable account ID.'
			);
		}
	}
}

export function createBrowserConfigurationRepository(): IndexedDbConfigurationRepository {
	if (typeof indexedDB === 'undefined') {
		throw new ConfigurationRepositoryError(
			'storage-unavailable',
			'IndexedDB is unavailable in this browser.'
		);
	}
	return new IndexedDbConfigurationRepository({ factory: indexedDB });
}
