import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { archiveSessionIds, cockpitAccountIds, seedArchiveSessions } from './database';

function archiveCard(page: Page, date: string): Locator {
	return page.locator('.session-archive-card').filter({
		has: page.getByRole('heading', { name: date, exact: true })
	});
}

function liabilityCard(page: Page, name: string): Locator {
	return page.locator('article.liability-card').filter({
		has: page.getByRole('heading', { name, exact: true })
	});
}

test.beforeEach(async ({ page }) => {
	await seedArchiveSessions(page);
});

test('Archive is newest-first with balanced summaries and read-only replay', async ({ page }) => {
	await page.goto('/archive/');
	const cards = page.locator('.session-archive-card');
	await expect(cards).toHaveCount(3);
	await expect(cards.nth(0).getByRole('heading', { name: '2026-06-21' })).toBeVisible();
	await expect(cards.nth(1).getByRole('heading', { name: '2026-06-20' })).toBeVisible();
	await expect(cards.nth(2).getByRole('heading', { name: '2026-06-18' })).toBeVisible();
	await expect(archiveCard(page, '2026-06-21').getByText('$10.00', { exact: true })).toBeVisible();
	await expect(archiveCard(page, '2026-06-20').getByText('Incomplete draft')).toBeVisible();
	await expect(archiveCard(page, '2026-06-20').getByText('Draft', { exact: true })).toBeVisible();

	await archiveCard(page, '2026-06-18').click();
	await expect(page.getByRole('heading', { level: 1, name: '2026-06-18 sit-down' })).toBeVisible();
	await expect(page.getByText('Read-only replay')).toBeVisible();
	await expect(page.getByText('Old session note')).toBeVisible();
	await expect(page.getByText('$25.00', { exact: true })).toBeVisible();
	await expect(page.locator('input, select, textarea')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Edit Session' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Discard Draft' })).toHaveCount(0);
});

test('a draft is unmistakable in replay and opens the draft lifecycle', async ({ page }) => {
	await page.goto('/archive/');
	await archiveCard(page, '2026-06-20').click();
	await expect(page.getByText('Draft', { exact: true })).toBeVisible();
	await expect(page.getByText('Not selected', { exact: true }).first()).toBeVisible();
	await page.getByRole('link', { name: 'Resume Draft' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Sit Down' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Stand Up' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save Corrections' })).toHaveCount(0);
});

test('draft replay can discard the draft without touching completed history', async ({ page }) => {
	await page.goto('/archive/session/?session=' + archiveSessionIds.draft);
	await expect(page.getByText('Draft', { exact: true })).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Discard Draft' }).click();
	await expect(page).toHaveURL(/\/archive\/\?discarded=1/);
	await expect(page.getByText('Draft discarded.')).toBeVisible();
	await expect(page.locator('.session-archive-card')).toHaveCount(2);
	await expect(archiveCard(page, '2026-06-20')).toHaveCount(0);
	await expect(archiveCard(page, '2026-06-21')).toBeVisible();
	await expect(archiveCard(page, '2026-06-18')).toBeVisible();
});

test('confirmation corrections save once with exact before and after audit values', async ({
	page
}) => {
	await page.goto('/archive/session/?session=' + archiveSessionIds.old);
	await page.getByRole('link', { name: 'Edit Session' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Edit Session' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
	const card = liabilityCard(page, 'Card A');
	await card.getByLabel('Confirmation ID').fill('POSTED-123');
	await expect(page.getByText(/Nothing changes until you choose Save Corrections/)).toBeVisible();
	await page.getByRole('button', { name: 'Save Corrections' }).click();

	await expect(page.getByText('Corrections saved with an audit trail.')).toBeVisible();
	await expect(page.getByText('POSTED-123', { exact: true })).toBeVisible();
	const audits = await page.evaluate(
		() =>
			new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const getAll = database.transaction('auditEntries').objectStore('auditEntries').getAll();
					getAll.onsuccess = () => {
						database.close();
						resolve(getAll.result as Array<Record<string, unknown>>);
					};
					getAll.onerror = () => reject(getAll.error);
				};
			})
	);
	expect(audits).toHaveLength(1);
	expect(audits[0]).toMatchObject({
		entityType: 'payment-record',
		before: { confirmationId: null },
		after: { confirmationId: 'POSTED-123' },
		notes: null
	});

	await page.goto('/archive/');
	await expect(page.locator('.session-archive-card').nth(0)).toContainText('2026-06-21');
});

test('correcting an old payment recalculates only that session', async ({ page }) => {
	await page.goto('/archive/session/?session=' + archiveSessionIds.old);
	await page.getByRole('link', { name: 'Edit Session' }).click();
	const card = liabilityCard(page, 'Card A');
	await card.getByLabel('Payment amount').fill('$20.00');
	await expect(
		page.locator('article.asset-projection').getByText('$80.00', { exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Save Corrections' }).click();
	await expect(page.getByText('Corrections saved with an audit trail.')).toBeVisible();
	await expect(page.getByText('$20.00', { exact: true }).first()).toBeVisible();

	const stored = await page.evaluate(
		() =>
			new Promise<{ oldFinal: number; newestFinal: number }>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const store = database.transaction('accountRecords').objectStore('accountRecords');
					const oldRequest = store.get('20000000-0000-4000-8000-000000000001');
					const newestRequest = store.get('20000000-0000-4000-8000-000000000003');
					let oldFinal = 0;
					let newestFinal = 0;
					const finish = () => {
						if (!oldFinal || !newestFinal) return;
						database.close();
						resolve({ oldFinal, newestFinal });
					};
					oldRequest.onsuccess = () => {
						oldFinal = oldRequest.result.finalBalance;
						finish();
					};
					newestRequest.onsuccess = () => {
						newestFinal = newestRequest.result.finalBalance;
						finish();
					};
				};
			})
	);
	expect(stored).toEqual({ oldFinal: 8_000, newestFinal: 19_000 });
});

test('renamed and archived accounts remain readable in old sessions', async ({ page }) => {
	await page.goto('/archive/');
	await page.evaluate(
		({ accountId }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('stashy', 3);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('accounts', 'readwrite');
					const store = transaction.objectStore('accounts');
					const get = store.get(accountId);
					get.onsuccess = () => store.put({ ...get.result, name: 'Renamed Card', archived: true });
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		{ accountId: cockpitAccountIds.cardA }
	);
	await page.reload();
	await expect(archiveCard(page, '2026-06-18').getByText('Renamed Card')).toBeVisible();
	await archiveCard(page, '2026-06-18').click();
	await expect(page.getByRole('heading', { name: 'Renamed Card' })).toBeVisible();
	await expect(page.getByText('Archived account')).toBeVisible();
});

test('missing and malformed session links provide useful recovery', async ({ page }) => {
	await page.goto('/archive/session/?session=not-a-uuid');
	await expect(page.getByRole('heading', { name: 'This session could not open.' })).toBeVisible();
	await expect(page.getByText(/address is malformed/)).toBeVisible();
	await page.goto('/archive/session/?session=ffffffff-ffff-4fff-8fff-ffffffffffff');
	await expect(
		page.getByRole('heading', { name: 'That session is not in the stash.' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to Archive' })).toBeVisible();
});

test('Archive and replay remain accessible and usable on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/archive/');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	await archiveCard(page, '2026-06-18').click();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	const dimensions = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
