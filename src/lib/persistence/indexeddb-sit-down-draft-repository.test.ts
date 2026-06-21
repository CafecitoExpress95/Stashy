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
import { IndexedDbSitDownDraftRepository } from './indexeddb-sit-down-draft-repository';
import {
	ACCOUNTS_STORE,
	ACCOUNT_RECORDS_STORE,
	APP_SETTINGS_STORE,
	PAYMENT_RECORDS_STORE,
	SESSIONS_STORE,
	STASHY_DATABASE_NAME,
	STASHY_DATABASE_VERSION
} from './schema';
import type { SitDownDraftSnapshot } from './sit-down-draft-repository';

const createdAt = isoTimestampFromString('2026-06-20T12:00:00.000Z');
const savedAt = new Date('2026-06-20T13:00:00.000Z');
const sessionId = sessionIdFromString('a0000000-0000-4000-8000-000000000001');
const assetId = accountIdFromString('a0000000-0000-4000-8000-000000000002');
const liabilityId = accountIdFromString('a0000000-0000-4000-8000-000000000003');

function snapshot(id = sessionId): SitDownDraftSnapshot {
	return {
		session: {
			id,
			sitDownDate: sitDownDateFromString('2026-06-20'),
			isDraft: true,
			createdAt,
			updatedAt: createdAt
		},
		accountRecords: [
			{
				id: accountRecordIdFromString('b0000000-0000-4000-8000-000000000001'),
				sessionId: id,
				accountId: assetId,
				openingBalance: moneyFromMinorUnits(100_000),
				finalBalance: moneyFromMinorUnits(100_000),
				openingStatementBalance: null,
				finalStatementBalance: null,
				createdAt,
				updatedAt: createdAt
			},
			{
				id: accountRecordIdFromString('b0000000-0000-4000-8000-000000000002'),
				sessionId: id,
				accountId: liabilityId,
				createdAt,
				updatedAt: createdAt
			}
		],
		paymentRecords: [
			{
				id: paymentRecordIdFromString('c0000000-0000-4000-8000-000000000001'),
				sessionId: id,
				liabilityAccountId: liabilityId,
				confirmationId: null,
				notes: 'Still deciding',
				createdAt,
				updatedAt: createdAt
			}
		]
	};
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

let factory: IDBFactory;
let repository: IndexedDbSitDownDraftRepository;

beforeEach(() => {
	factory = new IDBFactory();
	repository = new IndexedDbSitDownDraftRepository({ factory, now: () => savedAt });
});

describe('schema migration', () => {
	it('upgrades a version 1 configuration database without losing accounts', async () => {
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
		await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
		versionOne.close();

		await repository.saveDraft(snapshot());
		const configuration = await new IndexedDbConfigurationRepository({
			factory,
			now: () => savedAt,
			randomUUID: () => 'd0000000-0000-4000-8000-000000000001'
		}).loadConfiguration();
		expect(configuration.accounts.map((account) => account.name)).toEqual(['Checking']);
		const database = await openDatabase(factory);
		expect([...database.objectStoreNames]).toEqual(
			expect.arrayContaining([SESSIONS_STORE, ACCOUNT_RECORDS_STORE, PAYMENT_RECORDS_STORE])
		);
		database.close();
	});
});

describe('draft persistence', () => {
	it('atomically saves and reloads an intentionally incomplete draft', async () => {
		const saved = await repository.saveDraft(snapshot());
		expect(saved.session.updatedAt).toBe('2026-06-20T13:00:00.000Z');
		const reloaded = await new IndexedDbSitDownDraftRepository({ factory }).loadLatestDraft();
		expect(reloaded).toEqual(saved);
		expect(reloaded?.paymentRecords[0]).toEqual(
			expect.objectContaining({
				sourceAssetAccountId: undefined,
				paymentMode: undefined,
				startingStatementBalance: undefined
			})
		);
		expect(reloaded?.accountRecords[1].openingStatementBalance).toBeUndefined();
	});

	it('upserts the same IDs without creating duplicate child records', async () => {
		await repository.saveDraft(snapshot());
		await repository.saveDraft({
			...snapshot(),
			paymentRecords: [{ ...snapshot().paymentRecords[0], notes: 'Updated note' }]
		});
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

	it('rejects an invalid replacement before changing the saved draft', async () => {
		await repository.saveDraft(snapshot());
		const invalid = snapshot();
		await expect(
			repository.saveDraft({
				...invalid,
				paymentRecords: [
					{
						...invalid.paymentRecords[0],
						sessionId: sessionIdFromString('a0000000-0000-4000-8000-000000000099')
					}
				]
			})
		).rejects.toMatchObject({ code: 'invalid-draft' });
		expect((await repository.loadLatestDraft())?.paymentRecords[0].notes).toBe('Still deciding');
	});

	it('reports corrupt stored records instead of silently discarding them', async () => {
		await repository.saveDraft(snapshot());
		const database = await openDatabase(factory);
		const transaction = database.transaction(PAYMENT_RECORDS_STORE, 'readwrite');
		transaction.objectStore(PAYMENT_RECORDS_STORE).put({
			...snapshot().paymentRecords[0],
			startingAccountBalance: 1.5
		});
		await new Promise<void>((resolve) => (transaction.oncomplete = () => resolve()));
		database.close();
		await expect(repository.loadLatestDraft()).rejects.toMatchObject({ code: 'corrupt-data' });
	});
});
