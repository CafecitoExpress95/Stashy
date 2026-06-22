import type { Page } from '@playwright/test';

const DATABASE_NAME = 'stashy';

export const cockpitAccountIds = {
	checking: '00000000-0000-4000-8000-000000000001',
	savings: '00000000-0000-4000-8000-000000000002',
	cardA: '00000000-0000-4000-8000-000000000003',
	cardB: '00000000-0000-4000-8000-000000000004',
	cardC: '00000000-0000-4000-8000-000000000005'
} as const;

export async function resetTestDatabase(page: Page): Promise<void> {
	await page.goto('/');
	await page.evaluate(
		(databaseName) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase(databaseName);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
				request.onblocked = () => reject(new Error('Stashy database reset was blocked.'));
			}),
		DATABASE_NAME
	);
}

export async function seedCockpitConfiguration(page: Page): Promise<void> {
	await resetTestDatabase(page);
	await page.goto('/configuration/accounts/');
	await page.getByRole('heading', { name: 'Accounts', exact: true }).waitFor();
	await page
		.getByRole('heading', {
			name: 'Start with the accounts you actually touch during a sit-down.'
		})
		.waitFor();
	await page.evaluate(
		({ databaseName, ids }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open(databaseName, 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('accounts', 'readwrite');
					const store = transaction.objectStore('accounts');
					const timestamp = '2026-06-20T12:00:00.000Z';
					for (const account of [
						{
							id: ids.checking,
							type: 'asset',
							name: 'Checking',
							archived: false,
							sortOrder: 0,
							thresholdPolicy: {
								mode: 'custom',
								thresholds: { warningBelow: 40_000, dangerBelow: 10_000 }
							},
							createdAt: timestamp,
							updatedAt: timestamp
						},
						{
							id: ids.savings,
							type: 'asset',
							name: 'Savings',
							archived: false,
							sortOrder: 1,
							thresholdPolicy: { mode: 'off' },
							createdAt: timestamp,
							updatedAt: timestamp
						},
						...[
							[ids.cardA, 'Card A', 0],
							[ids.cardB, 'Card B', 1],
							[ids.cardC, 'Card C', 2]
						].map(([id, name, sortOrder]) => ({
							id,
							type: 'liability',
							name,
							archived: false,
							sortOrder,
							createdAt: timestamp,
							updatedAt: timestamp
						}))
					]) {
						store.put(account);
					}
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		{ databaseName: DATABASE_NAME, ids: cockpitAccountIds }
	);
}

export const archiveSessionIds = {
	old: '10000000-0000-4000-8000-000000000001',
	draft: '10000000-0000-4000-8000-000000000002',
	newest: '10000000-0000-4000-8000-000000000003'
} as const;

export async function seedArchiveSessions(page: Page): Promise<void> {
	await seedCockpitConfiguration(page);
	await page.evaluate(
		({ databaseName, accountIds, sessionIds }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open(databaseName, 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['sessions', 'accountRecords', 'paymentRecords'],
						'readwrite'
					);
					const sessions = transaction.objectStore('sessions');
					const accountRecords = transaction.objectStore('accountRecords');
					const paymentRecords = transaction.objectStore('paymentRecords');

					const completed = [
						{
							id: sessionIds.old,
							date: '2026-06-18',
							timestamp: '2026-06-18T12:00:00.000Z',
							assetOpening: 10_000,
							assetFinal: 7_500,
							liabilityOpening: 4_000,
							liabilityFinal: 1_500,
							payment: 2_500,
							confirmation: null,
							notes: 'Old session note',
							suffix: '1'
						},
						{
							id: sessionIds.newest,
							date: '2026-06-21',
							timestamp: '2026-06-21T12:00:00.000Z',
							assetOpening: 20_000,
							assetFinal: 19_000,
							liabilityOpening: 3_000,
							liabilityFinal: 2_000,
							payment: 1_000,
							confirmation: 'NEW-100',
							notes: 'Newest session note',
							suffix: '3'
						}
					];

					for (const item of completed) {
						sessions.put({
							id: item.id,
							sitDownDate: item.date,
							isDraft: false,
							createdAt: item.timestamp,
							updatedAt: item.timestamp
						});
						accountRecords.put({
							id: '20000000-0000-4000-8000-00000000000' + item.suffix,
							sessionId: item.id,
							accountId: accountIds.checking,
							openingBalance: item.assetOpening,
							finalBalance: item.assetFinal,
							openingStatementBalance: null,
							finalStatementBalance: null,
							createdAt: item.timestamp,
							updatedAt: item.timestamp
						});
						accountRecords.put({
							id: '30000000-0000-4000-8000-00000000000' + item.suffix,
							sessionId: item.id,
							accountId: accountIds.cardA,
							openingBalance: item.liabilityOpening,
							finalBalance: item.liabilityFinal,
							openingStatementBalance: null,
							finalStatementBalance: null,
							createdAt: item.timestamp,
							updatedAt: item.timestamp
						});
						paymentRecords.put({
							id: '40000000-0000-4000-8000-00000000000' + item.suffix,
							sessionId: item.id,
							liabilityAccountId: accountIds.cardA,
							sourceAssetAccountId: accountIds.checking,
							paymentMode: 'custom',
							paymentAmount: item.payment,
							startingAccountBalance: item.liabilityOpening,
							startingStatementBalance: null,
							remainingAccountBalance: item.liabilityFinal,
							remainingStatementBalance: null,
							confirmationId: item.confirmation,
							notes: item.notes,
							createdAt: item.timestamp,
							updatedAt: item.timestamp
						});
					}

					const draftTimestamp = '2026-06-20T12:00:00.000Z';
					sessions.put({
						id: sessionIds.draft,
						sitDownDate: '2026-06-20',
						isDraft: true,
						createdAt: draftTimestamp,
						updatedAt: draftTimestamp
					});
					accountRecords.put({
						id: '20000000-0000-4000-8000-000000000002',
						sessionId: sessionIds.draft,
						accountId: accountIds.checking,
						openingBalance: 30_000,
						finalBalance: 30_000,
						openingStatementBalance: null,
						finalStatementBalance: null,
						createdAt: draftTimestamp,
						updatedAt: draftTimestamp
					});
					accountRecords.put({
						id: '30000000-0000-4000-8000-000000000002',
						sessionId: sessionIds.draft,
						accountId: accountIds.cardA,
						createdAt: draftTimestamp,
						updatedAt: draftTimestamp
					});
					paymentRecords.put({
						id: '40000000-0000-4000-8000-000000000002',
						sessionId: sessionIds.draft,
						liabilityAccountId: accountIds.cardA,
						confirmationId: null,
						notes: 'Draft note',
						createdAt: draftTimestamp,
						updatedAt: draftTimestamp
					});

					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		{ databaseName: DATABASE_NAME, accountIds: cockpitAccountIds, sessionIds: archiveSessionIds }
	);
}
