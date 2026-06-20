import type { Page } from '@playwright/test';

const DATABASE_NAME = 'stashy';

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
