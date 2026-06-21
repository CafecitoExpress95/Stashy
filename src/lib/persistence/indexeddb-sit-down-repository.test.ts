import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	accountIdFromString,
	accountRecordIdFromString,
	appSettingsIdFromString,
	isoTimestampFromString,
	moneyFromMinorUnits,
	paymentRecordIdFromString,
	sessionIdFromString,
	sitDownDateFromString,
	type AppSettings
} from '$lib/domain';
import { IndexedDbConfigurationRepository } from './indexeddb-configuration-repository';
import { IndexedDbSitDownRepository } from './indexeddb-sit-down-repository';
import {
	ACCOUNTS_STORE,
	ACCOUNT_RECORDS_STORE,
	ACCOUNT_RECORD_ACCOUNT_INDEX,
	ACCOUNT_RECORD_SESSION_INDEX,
	APP_SETTINGS_STORE,
	AUDIT_ENTRIES_STORE,
	PAYMENT_RECORDS_STORE,
	PAYMENT_RECORD_LIABILITY_INDEX,
	PAYMENT_RECORD_SESSION_INDEX,
	PAYMENT_RECORD_SOURCE_INDEX,
	SESSIONS_STORE,
	SESSION_DRAFT_INDEX,
	SESSION_SIT_DOWN_DATE_INDEX,
	SESSION_UPDATED_AT_INDEX,
	STASHY_DATABASE_NAME,
	STASHY_DATABASE_VERSION
} from './schema';
import type { SitDownDraftSnapshot, StoodUpSitDownSnapshot } from './sit-down-repository';

const createdAt = isoTimestampFromString('2026-06-20T12:00:00.000Z');
const savedAt = new Date('2026-06-20T13:00:00.000Z');
const sessionId = sessionIdFromString('a0000000-0000-4000-8000-000000000001');
const assetId = accountIdFromString('a0000000-0000-4000-8000-000000000002');
const liabilityId = accountIdFromString('a0000000-0000-4000-8000-000000000003');
const assetRecordId = accountRecordIdFromString('b0000000-0000-4000-8000-000000000001');
const liabilityRecordId = accountRecordIdFromString('b0000000-0000-4000-8000-000000000002');
const paymentId = paymentRecordIdFromString('c0000000-0000-4000-8000-000000000001');

function draftSnapshot(): SitDownDraftSnapshot {
	return {
		session: {
			id: sessionId,
			sitDownDate: sitDownDateFromString('2026-06-20'),
			isDraft: true,
			createdAt,
			updatedAt: createdAt
		},
		accountRecords: [
			{
				id: assetRecordId,
				sessionId,
				accountId: assetId,
				openingBalance: moneyFromMinorUnits(100_000),
				finalBalance: moneyFromMinorUnits(100_000),
				openingStatementBalance: null,
				finalStatementBalance: null,
				createdAt,
				updatedAt: createdAt
			},
			{
				id: liabilityRecordId,
				sessionId,
				accountId: liabilityId,
				createdAt,
				updatedAt: createdAt
			}
		],
		paymentRecords: [
			{
				id: paymentId,
				sessionId,
				liabilityAccountId: liabilityId,
				confirmationId: null,
				notes: 'Still deciding',
				createdAt,
				updatedAt: createdAt
			}
		]
	};
}

function stoodUpSnapshot(): StoodUpSitDownSnapshot {
	return {
		session: { ...draftSnapshot().session, isDraft: false },
		accountRecords: [
			{
				id: assetRecordId,
				sessionId,
				accountId: assetId,
				openingBalance: moneyFromMinorUnits(100_000),
				finalBalance: moneyFromMinorUnits(75_000),
				openingStatementBalance: null,
				finalStatementBalance: null,
				createdAt,
				updatedAt: createdAt
			},
			{
				id: liabilityRecordId,
				sessionId,
				accountId: liabilityId,
				openingBalance: moneyFromMinorUnits(40_000),
				finalBalance: moneyFromMinorUnits(15_000),
				openingStatementBalance: null,
				finalStatementBalance: null,
				createdAt,
				updatedAt: createdAt
			}
		],
		paymentRecords: [
			{
				id: paymentId,
				sessionId,
				liabilityAccountId: liabilityId,
				sourceAssetAccountId: assetId,
				paymentMode: 'custom',
				paymentAmount: moneyFromMinorUnits(25_000),
				startingAccountBalance: moneyFromMinorUnits(40_000),
				startingStatementBalance: null,
				remainingAccountBalance: moneyFromMinorUnits(15_000),
				remainingStatementBalance: null,
				confirmationId: null,
				notes: 'No confirmation yet',
				createdAt,
				updatedAt: createdAt
			}
		]
	};
}

function openDatabase(
	factory: IDBFactory,
	version = STASHY_DATABASE_VERSION
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(STASHY_DATABASE_NAME, version);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}

let factory: IDBFactory;
let repository: IndexedDbSitDownRepository;

beforeEach(() => {
	factory = new IDBFactory();
	repository = new IndexedDbSitDownRepository({ factory, now: () => savedAt });
});

describe('schema migration', () => {
	it('upgrades version 1 through version 3 without losing configuration', async () => {
		const settings: AppSettings = {
			id: appSettingsIdFromString('00000000-0000-4000-8000-000000000001'),
			schemaVersion: 1,
			currency: 'USD',
			defaultAssetThresholds: null,
			lastImportedAt: null,
			lastExportedAt: null,
			createdAt,
			updatedAt: createdAt
		};
		const versionOne = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = factory.open(STASHY_DATABASE_NAME, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(APP_SETTINGS_STORE, { keyPath: 'id' });
				request.result.createObjectStore(ACCOUNTS_STORE, { keyPath: 'id' });
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const transaction = versionOne.transaction([APP_SETTINGS_STORE, ACCOUNTS_STORE], 'readwrite');
		transaction.objectStore(APP_SETTINGS_STORE).put(settings);
		transaction.objectStore(ACCOUNTS_STORE).put({
			id: assetId,
			type: 'asset',
			name: 'Checking',
			archived: false,
			sortOrder: 0,
			thresholdPolicy: { mode: 'inherit' },
			createdAt,
			updatedAt: createdAt
		});
		await transactionDone(transaction);
		versionOne.close();

		await repository.saveDraft(draftSnapshot());
		const configuration = await new IndexedDbConfigurationRepository({
			factory,
			now: () => savedAt,
			randomUUID: () => 'd0000000-0000-4000-8000-000000000001'
		}).loadConfiguration();
		expect(configuration.accounts.map((account) => account.name)).toEqual(['Checking']);
		const database = await openDatabase(factory);
		expect([...database.objectStoreNames]).toContain(AUDIT_ENTRIES_STORE);
		expect(
			database
				.transaction(SESSIONS_STORE)
				.objectStore(SESSIONS_STORE)
				.indexNames.contains(SESSION_DRAFT_INDEX)
		).toBe(false);
		database.close();
	});

	it('upgrades a version 2 draft and reopens it under version 3', async () => {
		const versionTwo = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = factory.open(STASHY_DATABASE_NAME, 2);
			request.onupgradeneeded = () => {
				request.result.createObjectStore(APP_SETTINGS_STORE, { keyPath: 'id' });
				request.result.createObjectStore(ACCOUNTS_STORE, { keyPath: 'id' });
				const sessions = request.result.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
				sessions.createIndex(SESSION_SIT_DOWN_DATE_INDEX, 'sitDownDate');
				sessions.createIndex(SESSION_UPDATED_AT_INDEX, 'updatedAt');
				sessions.createIndex(SESSION_DRAFT_INDEX, 'isDraft');
				const accountRecords = request.result.createObjectStore(ACCOUNT_RECORDS_STORE, {
					keyPath: 'id'
				});
				accountRecords.createIndex(ACCOUNT_RECORD_SESSION_INDEX, 'sessionId');
				accountRecords.createIndex(ACCOUNT_RECORD_ACCOUNT_INDEX, 'accountId');
				const payments = request.result.createObjectStore(PAYMENT_RECORDS_STORE, { keyPath: 'id' });
				payments.createIndex(PAYMENT_RECORD_SESSION_INDEX, 'sessionId');
				payments.createIndex(PAYMENT_RECORD_LIABILITY_INDEX, 'liabilityAccountId');
				payments.createIndex(PAYMENT_RECORD_SOURCE_INDEX, 'sourceAssetAccountId');
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const snapshot = draftSnapshot();
		const transaction = versionTwo.transaction(
			[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
			'readwrite'
		);
		transaction.objectStore(SESSIONS_STORE).put(snapshot.session);
		for (const record of snapshot.accountRecords)
			transaction.objectStore(ACCOUNT_RECORDS_STORE).put(record);
		for (const payment of snapshot.paymentRecords)
			transaction.objectStore(PAYMENT_RECORDS_STORE).put(payment);
		await transactionDone(transaction);
		versionTwo.close();

		expect(await repository.loadLatestSession()).toEqual(snapshot);
		const database = await openDatabase(factory);
		expect(database.version).toBe(3);
		expect([...database.objectStoreNames]).toContain(AUDIT_ENTRIES_STORE);
		database.close();
	});
});

describe('sit-down lifecycle persistence', () => {
	it('atomically saves and reloads an intentionally incomplete draft', async () => {
		const saved = await repository.saveDraft(draftSnapshot());
		expect(saved.session.updatedAt).toBe('2026-06-20T13:00:00.000Z');
		expect(await new IndexedDbSitDownRepository({ factory }).loadLatestSession()).toEqual(saved);
	});

	it('stands up complete records with blank confirmation IDs and nullable statements', async () => {
		await repository.saveDraft(draftSnapshot());
		const saved = await repository.standUp(stoodUpSnapshot());
		expect(saved.session.isDraft).toBe(false);
		expect(saved.paymentRecords[0].confirmationId).toBeNull();
		expect(saved.paymentRecords[0].startingStatementBalance).toBeNull();
		expect(await repository.loadLatestSession()).toEqual(saved);
	});

	it('repeated Stand Up writes preserve IDs without duplicate records', async () => {
		await repository.standUp(stoodUpSnapshot());
		await repository.standUp(stoodUpSnapshot());
		const database = await openDatabase(factory);
		const transaction = database.transaction(
			[SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE],
			'readonly'
		);
		const counts = await Promise.all([
			new Promise<number>((resolve) => {
				const request = transaction.objectStore(SESSIONS_STORE).count();
				request.onsuccess = () => resolve(request.result);
			}),
			new Promise<number>((resolve) => {
				const request = transaction.objectStore(ACCOUNT_RECORDS_STORE).count();
				request.onsuccess = () => resolve(request.result);
			}),
			new Promise<number>((resolve) => {
				const request = transaction.objectStore(PAYMENT_RECORDS_STORE).count();
				request.onsuccess = () => resolve(request.result);
			})
		]);
		expect(counts).toEqual([1, 2, 1]);
		database.close();
	});

	it('leaves the prior draft intact when the final transaction is interrupted', async () => {
		const original = await repository.saveDraft(draftSnapshot());
		const failing = new IndexedDbSitDownRepository({
			factory,
			now: () => new Date('2026-06-20T14:00:00.000Z'),
			beforeCommit(operation, transaction) {
				if (operation === 'stand-up') transaction.abort();
			}
		});
		await expect(failing.standUp(stoodUpSnapshot())).rejects.toMatchObject({
			code: 'storage-failed'
		});
		expect(await repository.loadLatestSession()).toEqual(original);
	});

	it('reports corrupt completed records rather than silently treating them as drafts', async () => {
		await repository.standUp(stoodUpSnapshot());
		const database = await openDatabase(factory);
		const transaction = database.transaction(PAYMENT_RECORDS_STORE, 'readwrite');
		transaction.objectStore(PAYMENT_RECORDS_STORE).put({
			...stoodUpSnapshot().paymentRecords[0],
			paymentAmount: 1.5
		});
		await transactionDone(transaction);
		database.close();
		await expect(repository.loadLatestSession()).rejects.toMatchObject({ code: 'corrupt-data' });
	});
});
