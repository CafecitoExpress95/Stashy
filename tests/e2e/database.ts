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

export const whiteboardSessionIds = {
	older: '50000000-0000-4000-8000-000000000001',
	sameDateEarly: '50000000-0000-4000-8000-000000000002',
	sameDateLate: '50000000-0000-4000-8000-000000000003',
	newest: '50000000-0000-4000-8000-000000000004',
	draft: '50000000-0000-4000-8000-000000000005'
} as const;

/** Seeds completed, same-date, sparse, archived, negative, and newer-draft Whiteboard history. */
export async function seedWhiteboardHistory(page: Page): Promise<void> {
	await seedCockpitConfiguration(page);
	await page.evaluate(
		({ databaseName, accountIds, sessionIds }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open(databaseName, 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['accounts', 'sessions', 'accountRecords', 'paymentRecords'],
						'readwrite'
					);
					const accounts = transaction.objectStore('accounts');
					const sessions = transaction.objectStore('sessions');
					const accountRecords = transaction.objectStore('accountRecords');
					const paymentRecords = transaction.objectStore('paymentRecords');
					const archivedCard = accounts.get(accountIds.cardB);
					archivedCard.onsuccess = () => {
						accounts.put({ ...archivedCard.result, archived: true });
					};

					const completed = [
						{
							id: sessionIds.older,
							date: '2026-06-18',
							timestamp: '2026-06-18T12:00:00.000Z',
							checking: [10_000, 7_500],
							cardA: [4_000, 1_500, 3_000, 500, 2_500],
							savings: [5_000, 5_000]
						},
						{
							id: sessionIds.sameDateEarly,
							date: '2026-06-20',
							timestamp: '2026-06-20T10:00:00.000Z',
							checking: [7_500, 6_000],
							cardA: [1_500, 1_000, 500, 250, 500]
						},
						{
							id: sessionIds.sameDateLate,
							date: '2026-06-20',
							timestamp: '2026-06-20T12:00:00.000Z',
							checking: [6_000, 5_000],
							cardA: [1_000, 500, 250, 0, 500]
						},
						{
							id: sessionIds.newest,
							date: '2026-06-21',
							timestamp: '2026-06-21T12:00:00.000Z',
							checking: [1_000, -500],
							cardA: [3_000, 2_000, 2_500, 1_500, 1_000],
							cardB: [5_000, 4_500, null, null, 500]
						}
					] as const;

					const addAccountRecord = (
						index: number,
						accountIndex: number,
						sessionId: string,
						accountId: string,
						balances: readonly [number, number],
						timestamp: string,
						statements: readonly [number | null, number | null] = [null, null]
					) => {
						accountRecords.put({
							id: '60000000-0000-4000-8000-' + String(index * 10 + accountIndex).padStart(12, '0'),
							sessionId,
							accountId,
							openingBalance: balances[0],
							finalBalance: balances[1],
							openingStatementBalance: statements[0],
							finalStatementBalance: statements[1],
							createdAt: timestamp,
							updatedAt: timestamp
						});
					};

					const addPayment = (
						index: number,
						accountIndex: number,
						sessionId: string,
						liabilityAccountId: string,
						values: readonly [number, number, number | null, number | null, number],
						timestamp: string
					) => {
						paymentRecords.put({
							id: '70000000-0000-4000-8000-' + String(index * 10 + accountIndex).padStart(12, '0'),
							sessionId,
							liabilityAccountId,
							sourceAssetAccountId: accountIds.checking,
							paymentMode: 'custom',
							paymentAmount: values[4],
							startingAccountBalance: values[0],
							startingStatementBalance: values[2],
							remainingAccountBalance: values[1],
							remainingStatementBalance: values[3],
							confirmationId: index === 4 ? 'WB-NEWEST' : null,
							notes: index === 4 ? 'Latest Whiteboard note' : 'Historical Whiteboard note',
							createdAt: timestamp,
							updatedAt: timestamp
						});
					};

					completed.forEach((item, zeroIndex) => {
						const index = zeroIndex + 1;
						sessions.put({
							id: item.id,
							sitDownDate: item.date,
							isDraft: false,
							createdAt: item.timestamp,
							updatedAt: item.timestamp
						});
						addAccountRecord(index, 1, item.id, accountIds.checking, item.checking, item.timestamp);
						addAccountRecord(
							index,
							2,
							item.id,
							accountIds.cardA,
							[item.cardA[0], item.cardA[1]],
							item.timestamp,
							[item.cardA[2], item.cardA[3]]
						);
						addPayment(index, 2, item.id, accountIds.cardA, item.cardA, item.timestamp);
						if ('savings' in item) {
							addAccountRecord(index, 3, item.id, accountIds.savings, item.savings, item.timestamp);
						}
						if ('cardB' in item) {
							addAccountRecord(
								index,
								4,
								item.id,
								accountIds.cardB,
								[item.cardB[0], item.cardB[1]],
								item.timestamp,
								[item.cardB[2], item.cardB[3]]
							);
							addPayment(index, 4, item.id, accountIds.cardB, item.cardB, item.timestamp);
						}
					});

					const draftTimestamp = '2026-06-22T12:00:00.000Z';
					sessions.put({
						id: sessionIds.draft,
						sitDownDate: '2026-06-22',
						isDraft: true,
						createdAt: draftTimestamp,
						updatedAt: draftTimestamp
					});
					accountRecords.put({
						id: '60000000-0000-4000-8000-000000000051',
						sessionId: sessionIds.draft,
						accountId: accountIds.checking,
						openingBalance: 999_999,
						finalBalance: 999_999,
						openingStatementBalance: null,
						finalStatementBalance: null,
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
		{ databaseName: DATABASE_NAME, accountIds: cockpitAccountIds, sessionIds: whiteboardSessionIds }
	);
}
