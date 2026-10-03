import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
	archiveSessionIds,
	cockpitAccountIds,
	resetTestDatabase,
	seedArchiveSessions
} from './database';

type StoredData = Record<string, Array<Record<string, unknown>>>;

async function readDatabase(page: Page): Promise<StoredData> {
	return page.evaluate(
		() =>
			new Promise<StoredData>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						Array.from(database.objectStoreNames),
						'readonly'
					);
					const data: StoredData = {};
					for (const name of database.objectStoreNames) {
						const read = transaction.objectStore(name).getAll();
						read.onsuccess = () => {
							data[name] = read.result;
						};
					}
					transaction.oncomplete = () => {
						database.close();
						resolve(data);
					};
					transaction.onabort = () => {
						database.close();
						reject(transaction.error);
					};
				};
			})
	);
}

async function openData(page: Page): Promise<void> {
	await page.goto('/configuration/data/');
	await expect(page.getByRole('heading', { name: 'Save & Restore', level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
}

async function downloadBackup(page: Page): Promise<Buffer> {
	const downloaded = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download backup' }).click();
	const download = await downloaded;
	expect(download.suggestedFilename()).toMatch(/^stashy-backup-\d{4}-\d{2}-\d{2}\.stashy$/);
	const path = await download.path();
	expect(path).not.toBeNull();
	return readFile(path!);
}

async function reviewBackup(page: Page, bytes: Buffer): Promise<void> {
	await page.locator('input[type=file]').setInputFiles({
		name: 'round-trip.stashy',
		mimeType: 'application/zip',
		buffer: bytes
	});
	await expect(page.getByRole('heading', { name: 'Review before full restore' })).toBeVisible();
}

async function restoreBackup(page: Page): Promise<void> {
	await page
		.getByRole('checkbox', { name: 'I understand this replaces all current local Stashy data.' })
		.check();
	await page.getByRole('button', { name: 'Replace and restore' }).click();
}

async function seedPopulatedBackup(page: Page): Promise<void> {
	await seedArchiveSessions(page);
	await page.goto('/sit-down/?session=' + archiveSessionIds.old);
	const card = page.locator('article.liability-card').filter({
		has: page.getByRole('heading', { name: 'Card A', exact: true })
	});
	await card.getByLabel('Confirmation ID').fill('BACKUP-AUDIT');
	await page.getByRole('button', { name: 'Save Corrections' }).click();
	await expect(page.getByText('Corrections saved with an audit trail.')).toBeVisible();
	await page.evaluate(
		(accountId) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('accounts', 'readwrite');
					const store = transaction.objectStore('accounts');
					const read = store.get(accountId);
					read.onsuccess = () => store.put({ ...read.result, archived: true });
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onabort = () => {
						database.close();
						reject(transaction.error);
					};
				};
			}),
		cockpitAccountIds.cardC
	);
	await openData(page);
}

function storedArchiveFiles(bytes: Buffer): Record<string, string> {
	return Object.fromEntries(
		Object.entries(unzipSync(bytes))
			.filter(
				([path]) =>
					path.endsWith('.json') && path !== 'manifest.json' && path !== 'metadata/export-info.json'
			)
			.map(([path, contents]) => [path, strFromU8(contents)])
	);
}

test('the UI restores an empty backup without a clone error', async ({ page }) => {
	await resetTestDatabase(page);
	await openData(page);
	const before = await readDatabase(page);
	await reviewBackup(page, await downloadBackup(page));
	await expect(page.getByRole('button', { name: 'Replace and restore' })).toBeDisabled();
	await restoreBackup(page);
	await expect(page.getByText('Backup restored.', { exact: true })).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
	expect(await readDatabase(page)).toEqual(before);
});

test('populated UI restore replaces all six stores and preserves nested audits and history', async ({
	page
}) => {
	await seedPopulatedBackup(page);
	const before = await readDatabase(page);
	expect(
		Object.fromEntries(Object.entries(before).map(([name, rows]) => [name, rows.length]))
	).toEqual({
		appSettings: 1,
		accounts: 5,
		sessions: 3,
		accountRecords: 6,
		paymentRecords: 3,
		auditEntries: 1
	});
	expect(before.auditEntries[0]).toMatchObject({
		before: { confirmationId: null },
		after: { confirmationId: 'BACKUP-AUDIT' }
	});
	const bytes = await downloadBackup(page);
	await page.evaluate(
		({ original, checkingId }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						Array.from(database.objectStoreNames),
						'readwrite'
					);
					for (const name of database.objectStoreNames) transaction.objectStore(name).clear();
					transaction
						.objectStore('appSettings')
						.put({ ...original.appSettings[0], defaultAssetThresholds: null });
					transaction.objectStore('accounts').put({
						...original.accounts.find((account) => account.id === checkingId),
						id: '90000000-0000-4000-8000-000000000001',
						name: 'Disposable asset',
						sortOrder: 0
					});
					transaction.objectStore('sessions').put({
						...original.sessions[0],
						id: '90000000-0000-4000-8000-000000000002',
						isDraft: true
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onabort = () => {
						database.close();
						reject(transaction.error);
					};
				};
			}),
		{ original: before, checkingId: cockpitAccountIds.checking }
	);
	await openData(page);
	await reviewBackup(page, bytes);
	await expect(page.getByText('This is a full replacement, not a merge.')).toBeVisible();
	await restoreBackup(page);
	await expect(page.getByText('Backup restored.', { exact: true })).toBeVisible();
	expect(await readDatabase(page)).toEqual(before);
	await expect(
		page.locator('dl[aria-label="Current local data"]').getByText('5', { exact: true })
	).toBeVisible();
	expect(storedArchiveFiles(await downloadBackup(page))).toEqual(storedArchiveFiles(bytes));
	await page.goto('/archive/');
	await expect(page.locator('.session-archive-card')).toHaveCount(3);
	await page.goto('/sit-down/?session=' + archiveSessionIds.old);
	await expect(
		page.locator('article.asset-projection').getByText('$75.00', { exact: true })
	).toBeVisible();
	await expect(page.getByLabel('Confirmation ID').first()).toHaveValue('BACKUP-AUDIT');
});

test('canceling a reviewed backup preserves every local record and resets confirmation', async ({
	page
}) => {
	await seedPopulatedBackup(page);
	const before = await readDatabase(page);
	const bytes = await downloadBackup(page);
	await reviewBackup(page, bytes);
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Review before full restore' })).toHaveCount(0);
	expect(await readDatabase(page)).toEqual(before);
	await reviewBackup(page, bytes);
	await expect(page.getByRole('button', { name: 'Replace and restore' })).toBeDisabled();
});

for (const corruption of [
	'malformed JSON',
	'missing settings',
	'broken account ID',
	'invalid money',
	'future schema'
] as const) {
	test(`${corruption} is rejected before local data changes`, async ({ page }) => {
		await seedPopulatedBackup(page);
		const before = await readDatabase(page);
		const files = unzipSync(await downloadBackup(page));
		const settingsPath = 'settings/app-settings.json';
		if (corruption === 'malformed JSON') files[settingsPath] = strToU8('{');
		else if (corruption === 'missing settings') delete files[settingsPath];
		else if (corruption === 'future schema') {
			const manifest = JSON.parse(strFromU8(files['manifest.json']));
			manifest.database.schemaVersion += 1;
			files['manifest.json'] = strToU8(JSON.stringify(manifest));
		} else {
			const path = Object.keys(files).find(
				(path) => path.includes('/account-records/') && path.endsWith('.json')
			)!;
			const record = JSON.parse(strFromU8(files[path]));
			if (corruption === 'broken account ID')
				record.accountId = '90000000-0000-4000-8000-000000000099';
			else record.openingBalance = 0.5;
			files[path] = strToU8(JSON.stringify(record));
		}
		await page.locator('input[type=file]').setInputFiles({
			name: 'invalid.stashy',
			mimeType: 'application/zip',
			buffer: Buffer.from(zipSync(files))
		});
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Replace and restore' })).toHaveCount(0);
		expect(await readDatabase(page)).toEqual(before);
	});
}

for (const failure of ['first write', 'late write', 'transaction abort'] as const) {
	test(`${failure} rolls back all six stores without unhandled errors and can be retried`, async ({
		page
	}) => {
		await seedPopulatedBackup(page);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const before = await readDatabase(page);
		await reviewBackup(page, await downloadBackup(page));
		await page.evaluate((failure) => {
			const original = IDBObjectStore.prototype.put;
			IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
				if (this.name === (failure === 'first write' ? 'appSettings' : 'auditEntries')) {
					IDBObjectStore.prototype.put = original;
					if (failure === 'transaction abort') {
						const request = original.apply(this, args);
						this.transaction.abort();
						return request;
					}
					// Force a native synchronous clone error after earlier writes have been queued.
					return original.call(this, new Proxy(args[0], {}));
				}
				return original.apply(this, args);
			};
		}, failure);
		await restoreBackup(page);
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Replace and restore' })).toBeEnabled();
		expect(await readDatabase(page)).toEqual(before);
		expect(errors).toEqual([]);
		await page.getByRole('button', { name: 'Replace and restore' }).click();
		await expect(page.getByText('Backup restored.', { exact: true })).toBeVisible();
		expect(await readDatabase(page)).toEqual(before);
		expect(errors).toEqual([]);
	});
}

test('backup review is accessible and fits a mobile viewport', async ({ page }) => {
	await seedPopulatedBackup(page);
	await reviewBackup(page, await downloadBackup(page));
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.getByRole('button', { name: 'Replace and restore' }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('button', { name: 'Replace and restore' })).toBeInViewport();
});
