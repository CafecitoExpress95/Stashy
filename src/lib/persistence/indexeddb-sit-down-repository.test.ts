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
import { parseStoredAuditEntry } from './records';
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
let auditId: number;

beforeEach(() => {
	factory = new IDBFactory();
	auditId = 1;
	repository = new IndexedDbSitDownRepository({
		factory,
		now: () => savedAt,
		randomUUID: () => `d0000000-0000-4000-8000-${String(auditId++).padStart(12, '0')}`
	});
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

function laterStoodUpSnapshot(): StoodUpSitDownSnapshot {
	const laterSessionId = sessionIdFromString('e0000000-0000-4000-8000-000000000001');
	return {
		session: {
			...stoodUpSnapshot().session,
			id: laterSessionId,
			sitDownDate: sitDownDateFromString('2026-06-21'),
			createdAt: isoTimestampFromString('2026-06-21T12:00:00.000Z'),
			updatedAt: isoTimestampFromString('2026-06-21T12:00:00.000Z')
		},
		accountRecords: stoodUpSnapshot().accountRecords.map((record, index) => ({
			...record,
			id: accountRecordIdFromString(
				'f0000000-0000-4000-8000-' + String(index + 1).padStart(12, '0')
			),
			sessionId: laterSessionId,
			createdAt: isoTimestampFromString('2026-06-21T12:00:00.000Z'),
			updatedAt: isoTimestampFromString('2026-06-21T12:00:00.000Z')
		})),
		paymentRecords: stoodUpSnapshot().paymentRecords.map((record, index) => ({
			...record,
			id: paymentRecordIdFromString(
				'80000000-0000-4000-8000-' + String(index + 1).padStart(12, '0')
			),
			sessionId: laterSessionId,
			createdAt: isoTimestampFromString('2026-06-21T12:00:00.000Z'),
			updatedAt: isoTimestampFromString('2026-06-21T12:00:00.000Z')
		}))
	};
}

async function storedAudits(): Promise<ReturnType<typeof parseStoredAuditEntry>[]> {
	const database = await openDatabase(factory);
	const transaction = database.transaction(AUDIT_ENTRIES_STORE, 'readonly');
	const request = transaction.objectStore(AUDIT_ENTRIES_STORE).getAll();
	const values = await new Promise<unknown[]>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result as unknown[]);
		request.onerror = () => reject(request.error);
	});
	await transactionDone(transaction);
	database.close();
	return values.map(parseStoredAuditEntry);
}

describe('Phase 5 archive and corrections', () => {
	it('lists sessions by sit-down date and loads one session by ID', async () => {
		const older = await repository.standUp(stoodUpSnapshot());
		const newer = await repository.standUp(laterStoodUpSnapshot());
		expect((await repository.listSessions()).map((snapshot) => snapshot.session.id)).toEqual([
			newer.session.id,
			older.session.id
		]);
		expect(await repository.loadSession(older.session.id)).toEqual(older);
		expect(
			await repository.loadSession(sessionIdFromString('ffffffff-ffff-4fff-8fff-ffffffffffff'))
		).toBeNull();
	});

	it('audits a confirmation correction with exact before and after values', async () => {
		const original = await repository.standUp(stoodUpSnapshot());
		const corrected = {
			...original,
			paymentRecords: original.paymentRecords.map((payment) => ({
				...payment,
				confirmationId: 'POSTED-123'
			}))
		};
		const result = await repository.saveStoodUpCorrection(corrected);
		expect(result.auditEntries).toHaveLength(1);
		expect(result.auditEntries[0]).toMatchObject({
			entityType: 'payment-record',
			before: { confirmationId: null },
			after: { confirmationId: 'POSTED-123' },
			notes: null
		});
		expect(await storedAudits()).toEqual(result.auditEntries);
	});

	it('updates one old snapshot without changing a later session', async () => {
		const original = await repository.standUp(stoodUpSnapshot());
		const later = await repository.standUp(laterStoodUpSnapshot());
		const corrected: StoodUpSitDownSnapshot = {
			session: original.session,
			accountRecords: original.accountRecords.map((record) =>
				record.accountId === assetId
					? { ...record, finalBalance: moneyFromMinorUnits(80_000) }
					: { ...record, finalBalance: moneyFromMinorUnits(20_000) }
			),
			paymentRecords: original.paymentRecords.map((payment) => ({
				...payment,
				paymentAmount: moneyFromMinorUnits(20_000),
				remainingAccountBalance: moneyFromMinorUnits(20_000)
			}))
		};
		const result = await repository.saveStoodUpCorrection(corrected);
		expect(result.auditEntries.map((entry) => entry.entityType).sort()).toEqual([
			'account-record',
			'account-record',
			'payment-record'
		]);
		expect(await repository.loadSession(later.session.id)).toEqual(later);
		expect((await repository.listSessions()).map((snapshot) => snapshot.session.id)).toEqual([
			later.session.id,
			original.session.id
		]);
	});

	it('requires the audited path for semantic changes after Stand Up', async () => {
		const original = await repository.standUp(stoodUpSnapshot());
		await expect(
			repository.standUp({
				...original,
				paymentRecords: original.paymentRecords.map((payment) => ({
					...payment,
					notes: 'Bypass attempt'
				}))
			})
		).rejects.toMatchObject({ code: 'invalid-session' });
		expect(await repository.loadSession(original.session.id)).toEqual(original);
		expect(await storedAudits()).toEqual([]);
	});

	it('does not create audit noise for a no-op correction', async () => {
		const original = await repository.standUp(stoodUpSnapshot());
		const result = await repository.saveStoodUpCorrection(original);
		expect(result.snapshot).toEqual(original);
		expect(result.auditEntries).toEqual([]);
		expect(await storedAudits()).toEqual([]);
	});

	it('rejects demotion and changed historical relationships', async () => {
		const original = await repository.standUp(stoodUpSnapshot());
		await expect(repository.saveDraft(draftSnapshot())).rejects.toMatchObject({
			code: 'invalid-session'
		});
		await expect(
			repository.saveStoodUpCorrection({
				...original,
				paymentRecords: original.paymentRecords.map((payment) => ({
					...payment,
					id: paymentRecordIdFromString('c0000000-0000-4000-8000-000000000099')
				}))
			})
		).rejects.toMatchObject({ code: 'invalid-session' });
	});

	it('aborts records and audits together when a correction write is interrupted', async () => {
		const original = await repository.standUp(stoodUpSnapshot());
		const failing = new IndexedDbSitDownRepository({
			factory,
			now: () => new Date('2026-06-20T14:00:00.000Z'),
			randomUUID: () => 'd0000000-0000-4000-8000-000000000099',
			beforeCommit(operation, transaction) {
				if (operation === 'save-correction') transaction.abort();
			}
		});
		await expect(
			failing.saveStoodUpCorrection({
				...original,
				paymentRecords: original.paymentRecords.map((payment) => ({
					...payment,
					notes: 'Corrected note'
				}))
			})
		).rejects.toMatchObject({ code: 'storage-failed' });
		expect(await repository.loadSession(original.session.id)).toEqual(original);
		expect(await storedAudits()).toEqual([]);
	});
});
