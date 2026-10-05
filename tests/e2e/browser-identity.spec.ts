import { expect, test, type Page } from '@playwright/test';
import {
	archiveSessionIds,
	resetTestDatabase,
	seedArchiveSessions,
	seedCockpitConfiguration
} from './database';

const previewUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Forward requests to the local production preview while preserving a real, nonsecure
// HTTP origin in Chromium. This exercises native API exposure without mocking Crypto.
test.use({ baseURL: 'http://stashy.test', viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
	await page.route('http://stashy.test/**', async (route) => {
		const requested = new URL(route.request().url());
		const response = await route.fetch({
			url: new URL(requested.pathname + requested.search, previewUrl).href
		});
		await route.fulfill({ response });
	});
});

async function storedRecords(page: Page, store: string): Promise<Array<Record<string, unknown>>> {
	return page.evaluate(
		(storeName) =>
			new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const getAll = database.transaction(storeName).objectStore(storeName).getAll();
					getAll.onsuccess = () => {
						database.close();
						resolve(getAll.result);
					};
					getAll.onerror = () => reject(getAll.error);
				};
			}),
		store
	);
}

test('nonsecure HTTP can create accounts, resume and complete drafts, and audit corrections', async ({
	page
}) => {
	await resetTestDatabase(page);
	expect(
		await page.evaluate(() => ({
			secure: isSecureContext,
			uuid: typeof crypto.randomUUID,
			random: typeof crypto.getRandomValues
		}))
	).toEqual({ secure: false, uuid: 'undefined', random: 'function' });
	await page.goto('/configuration/accounts/');
	for (const [name, type] of [
		['Checking', 'asset'],
		['Card A', 'liability']
	]) {
		await page.getByRole('button', { name: 'Add account' }).first().click();
		await page.getByLabel('Account name').fill(name);
		if (type === 'liability') await page.getByLabel('Liability').check();
		await page.getByRole('button', { name: 'Add account', exact: true }).last().click();
		await expect(page.getByText(`${name} added.`)).toBeVisible();
	}
	const accounts = await storedRecords(page, 'accounts');
	const checkingId = String(accounts.find((account) => account.name === 'Checking')!.id);
	await page.goto('/sit-down/');
	await expect(page.getByRole('heading', { name: 'Source assets', exact: true })).toBeVisible();
	await page.getByLabel('Opening balance').fill('100.00');
	await page.getByLabel('Account balance', { exact: true }).fill('25.00');
	await page.getByRole('button', { name: 'Full balance', exact: true }).click();
	await page.getByLabel('Pay from').selectOption(checkingId);
	await expect(page.locator('.projected-balance strong')).toHaveText('$75.00');
	await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
	await expect(page.getByText('Draft saved in this browser.', { exact: true })).toBeVisible();
	const [draft] = await storedRecords(page, 'sessions');
	const firstAccountRecords = await storedRecords(page, 'accountRecords');
	const firstPaymentRecords = await storedRecords(page, 'paymentRecords');
	await page.reload();
	await expect(page.getByLabel('Pay from')).toHaveValue(checkingId);
	await expect(page.locator('.projected-balance strong')).toHaveText('$75.00');
	await page.getByRole('button', { name: 'Stand Up', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Confirm Stand Up' }).click();
	await expect(page.getByRole('heading', { name: 'You stood up.' })).toBeVisible();
	expect(await storedRecords(page, 'sessions')).toMatchObject([{ id: draft.id, isDraft: false }]);
	expect(await storedRecords(page, 'accountRecords')).toMatchObject(
		firstAccountRecords.map(({ id }) => ({ id }))
	);
	expect(await storedRecords(page, 'paymentRecords')).toMatchObject(
		firstPaymentRecords.map(({ id }) => ({ id }))
	);

	await page.goto('/archive/session/?session=' + draft.id);
	await page.getByRole('link', { name: 'Edit Session' }).click();
	await page.getByLabel('Confirmation ID').fill('FOLD-HTTP-123');
	await page.getByRole('button', { name: 'Save Corrections', exact: true }).click();
	await expect(page.getByText('Corrections saved with an audit trail.')).toBeVisible();
	const audits = await storedRecords(page, 'auditEntries');
	expect(audits).toHaveLength(1);
	expect(audits[0]).toMatchObject({
		entityType: 'payment-record',
		before: { confirmationId: null },
		after: { confirmationId: 'FOLD-HTTP-123' }
	});
	await page.goto('/sit-down/');
	await page.getByRole('button', { name: 'Start New Sit-Down', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Source assets', exact: true })).toBeVisible();
	const sessions = await storedRecords(page, 'sessions');
	expect(sessions).toHaveLength(2);
	expect(sessions.filter((session) => session.id !== draft.id)).toMatchObject([{ isDraft: true }]);
	const identities = [
		...accounts,
		...sessions,
		...(await storedRecords(page, 'accountRecords')),
		...(await storedRecords(page, 'paymentRecords')),
		...audits
	].map((record) => record.id);
	for (const id of identities) expect(id).toMatch(uuidV4);
	expect(new Set(identities).size).toBe(identities.length);
});

test('a new sit-down opens on nonsecure HTTP with existing accounts', async ({ page }) => {
	await seedCockpitConfiguration(page);
	await page.goto('/sit-down/');
	await expect(page.getByRole('heading', { name: 'Source assets', exact: true })).toBeVisible();
});

test('existing history remains readable when secure random generation is unavailable', async ({
	page
}) => {
	await page.addInitScript(() => Object.defineProperty(window, 'crypto', { value: undefined }));
	await seedArchiveSessions(page);
	await page.goto('/archive/session/?session=' + archiveSessionIds.old);
	await expect(
		page.getByRole('heading', { name: '2026-06-18 sit-down', exact: true })
	).toBeVisible();
	await expect(page.getByText('Read-only replay', { exact: true })).toBeVisible();
	await expect(page.getByText('$25.00', { exact: true })).toBeVisible();
});
