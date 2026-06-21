import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { moneyFromMinorUnits, selectActiveAccounts } from '$lib/domain';
import { ConfigurationRepositoryError } from './configuration-repository';
import { IndexedDbConfigurationRepository } from './indexeddb-configuration-repository';
import {
	ACCOUNTS_STORE,
	STASHY_DATABASE_NAME,
	STASHY_DATABASE_VERSION,
	applyDatabaseMigrations
} from './schema';

const uuids = [
	'10000000-0000-4000-8000-000000000001',
	'10000000-0000-4000-8000-000000000002',
	'10000000-0000-4000-8000-000000000003',
	'10000000-0000-4000-8000-000000000004'
];

function createRepository(factory: IDBFactory): IndexedDbConfigurationRepository {
	let uuidIndex = 0;
	return new IndexedDbConfigurationRepository({
		factory,
		now: () => new Date('2026-06-20T12:00:00.000Z'),
		randomUUID: () => uuids[uuidIndex++] ?? uuids.at(-1)!
	});
}

function openRawDatabase(factory: IDBFactory): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = factory.open(STASHY_DATABASE_NAME, STASHY_DATABASE_VERSION);
		request.onupgradeneeded = (event) => {
			if (!request.transaction) throw new Error('Missing upgrade transaction.');
			applyDatabaseMigrations(
				request.result,
				request.transaction,
				event.oldVersion,
				event.newVersion ?? STASHY_DATABASE_VERSION
			);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

let factory: IDBFactory;
let repository: IndexedDbConfigurationRepository;

beforeEach(() => {
	factory = new IDBFactory();
	repository = createRepository(factory);
});

describe('configuration initialization and persistence', () => {
	it('creates disabled USD defaults in schema version 1', async () => {
		const snapshot = await repository.loadConfiguration();
		expect(snapshot.settings).toEqual(
			expect.objectContaining({
				schemaVersion: 1,
				currency: 'USD',
				defaultAssetThresholds: null
			})
		);
		expect(snapshot.accounts).toEqual([]);
	});

	it('persists asset and liability accounts across repository instances', async () => {
		const checking = await repository.createAccount({ type: 'asset', name: ' Checking ' });
		const card = await repository.createAccount({ type: 'liability', name: 'Card A' });
		expect(checking).toEqual(
			expect.objectContaining({
				name: 'Checking',
				sortOrder: 0,
				thresholdPolicy: { mode: 'inherit' }
			})
		);
		expect(card).toEqual(expect.objectContaining({ sortOrder: 0 }));

		const reloaded = await createRepository(factory).loadConfiguration();
		expect(reloaded.accounts.map((account) => account.name)).toEqual(['Checking', 'Card A']);
	});

	it('renames by ID without changing account type', async () => {
		const account = await repository.createAccount({ type: 'asset', name: 'Checking' });
		const updated = await repository.updateAccount(account.id, {
			name: 'Primary Checking',
			type: 'liability'
		} as never);
		expect(updated.name).toBe('Primary Checking');
		expect(updated.type).toBe('asset');
	});
});

describe('configuration safety', () => {
	it('rejects duplicate names even when the original account is archived', async () => {
		const account = await repository.createAccount({ type: 'liability', name: 'Card A' });
		await repository.setAccountArchived(account.id, true);
		await expect(
			repository.createAccount({ type: 'liability', name: ' card a ' })
		).rejects.toMatchObject({
			code: 'duplicate-account-name'
		});
		expect((await repository.loadConfiguration()).accounts).toHaveLength(1);
	});

	it('archives without deleting and excludes the account from active selection', async () => {
		const account = await repository.createAccount({ type: 'asset', name: 'Checking' });
		await repository.setAccountArchived(account.id, true);
		const snapshot = await repository.loadConfiguration();
		expect(snapshot.accounts).toHaveLength(1);
		expect(selectActiveAccounts(snapshot.accounts, 'asset')).toEqual([]);
	});

	it('reorders adjacent active accounts transactionally', async () => {
		const first = await repository.createAccount({ type: 'liability', name: 'Card A' });
		const second = await repository.createAccount({ type: 'liability', name: 'Card B' });
		await repository.moveAccount(second.id, 'up');
		const names = selectActiveAccounts(
			(await repository.loadConfiguration()).accounts,
			'liability'
		).map((account) => account.name);
		expect(names).toEqual(['Card B', 'Card A']);
		expect(first.id).not.toBe(second.id);
	});

	it('persists valid defaults and rejects invalid ordering without overwriting them', async () => {
		const valid = {
			warningBelow: moneyFromMinorUnits(40_000),
			dangerBelow: moneyFromMinorUnits(10_000)
		};
		await repository.updateDefaultAssetThresholds(valid);
		await expect(
			repository.updateDefaultAssetThresholds({
				warningBelow: moneyFromMinorUnits(10_000),
				dangerBelow: moneyFromMinorUnits(10_000)
			})
		).rejects.toMatchObject({ code: 'invalid-thresholds' });
		expect((await repository.loadConfiguration()).settings.defaultAssetThresholds).toEqual(valid);
	});

	it('reports corrupt records instead of silently resetting them', async () => {
		const database = await openRawDatabase(factory);
		const transaction = database.transaction(ACCOUNTS_STORE, 'readwrite');
		transaction.objectStore(ACCOUNTS_STORE).put({
			id: uuids[0],
			type: 'asset',
			name: 'Broken',
			archived: false,
			sortOrder: -1
		});
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
		database.close();

		await expect(repository.loadConfiguration()).rejects.toBeInstanceOf(
			ConfigurationRepositoryError
		);
		await expect(repository.loadConfiguration()).rejects.toMatchObject({ code: 'corrupt-data' });
	});
});
