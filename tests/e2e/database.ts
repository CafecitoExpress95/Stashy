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
				const request = indexedDB.open(databaseName, 2);
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
