import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { cockpitAccountIds, seedWhiteboardHistory, whiteboardSessionIds } from './database';

function latestCard(page: Page, name: string): Locator {
	return page.locator('.latest-state-card').filter({
		has: page.getByRole('heading', { name, exact: true })
	});
}

test.beforeEach(async ({ page }) => {
	await seedWhiteboardHistory(page);
});

test('Whiteboard uses the latest stood-up snapshot and excludes a newer draft', async ({
	page
}) => {
	await page.goto('/whiteboard/');
	await expect(page.getByRole('heading', { level: 1, name: 'Visit Whiteboard' })).toBeVisible();
	await expect(page.getByText('As of')).toBeVisible();
	await expect(page.getByText(/June 21, 2026/)).toBeVisible();
	await expect(latestCard(page, 'Checking').getByText('-$5.00', { exact: true })).toBeVisible();
	await expect(latestCard(page, 'Card A').getByText('$20.00', { exact: true })).toBeVisible();
	await expect(latestCard(page, 'Card B').getByText('Archived account')).toBeVisible();
	await expect(page.getByText('$9,999.99', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'View source session' }).first()).toHaveAttribute(
		'href',
		new RegExp(whiteboardSessionIds.newest)
	);
});

test('asset graph and table preserve exact sparse and same-date history', async ({ page }) => {
	await page.goto('/whiteboard/');
	await expect(page.getByRole('combobox', { name: 'Account' })).toHaveValue(
		cockpitAccountIds.checking
	);
	await expect(page.locator('.account-history-chart')).toHaveAttribute('data-chart-points', '4');
	await expect(
		page.getByRole('img', { name: /Checking final balance history chart/ })
	).toBeVisible();
	const rows = page.locator('.history-table tbody tr');
	await expect(rows).toHaveCount(4);
	await expect(
		page.locator('.history-table tbody').getByText('2026-06-20', { exact: true })
	).toHaveCount(2);
	await expect(rows.last().getByText('-$5.00', { exact: true })).toBeVisible();
	await expect(page.getByText(/Threshold lines use current settings/)).toContainText('$400.00');
	await expect(page.getByText(/Threshold lines use current settings/)).toContainText('$100.00');
});

test('chart selection and table keyboard controls open the same exact detail panel', async ({
	page
}) => {
	await page.goto('/whiteboard/');
	const canvas = page.getByRole('img', { name: /Checking final balance history chart/ });
	const box = await canvas.boundingBox();
	if (!box) throw new Error('Chart canvas did not render.');
	await canvas.click({
		position: { x: Math.round(box.width * 0.8), y: Math.round(box.height * 0.5) }
	});
	await expect(page.getByText('Selected snapshot')).toBeVisible();
	await page.getByRole('button', { name: 'Close' }).click();

	const tableButton = page.getByRole('button', {
		name: 'View details for Checking on 2026-06-18'
	});
	await tableButton.focus();
	await tableButton.press('Enter');
	await expect(page.getByRole('heading', { name: /June 18, 2026/ })).toBeVisible();
	await expect(
		page.locator('.history-point-detail').getByText('$100.00', { exact: true })
	).toBeVisible();
	await expect(
		page.locator('.history-point-detail').getByText('$75.00', { exact: true })
	).toBeVisible();
	await expect(
		page.locator('.history-point-detail').getByRole('link', { name: 'View source session' })
	).toHaveAttribute('href', new RegExp(whiteboardSessionIds.older));
});

test('liability details expose payments, source, confirmation, notes, and archived history', async ({
	page
}) => {
	await page.goto('/whiteboard/');
	await page.getByRole('combobox', { name: 'Account' }).selectOption(cockpitAccountIds.cardB);
	await expect(page).toHaveURL(new RegExp('account=' + cockpitAccountIds.cardB));
	await expect(page.getByText('Archived account').last()).toBeVisible();
	await expect(page.locator('.account-history-chart')).toHaveAttribute('data-chart-points', '1');
	await page.getByRole('button', { name: 'View details for Card B on 2026-06-21' }).click();
	const detail = page.locator('.history-point-detail');
	await expect(detail.getByText('$5.00', { exact: true })).toBeVisible();
	await expect(detail.getByText('Custom', { exact: true })).toBeVisible();
	await expect(detail.getByText('Checking', { exact: true })).toBeVisible();
	await expect(detail.getByText('WB-NEWEST', { exact: true })).toBeVisible();
	await expect(detail.getByText('Latest Whiteboard note', { exact: true })).toBeVisible();
});

test('accounts with one or zero points have useful sparse-history states', async ({ page }) => {
	await page.goto('/whiteboard/');
	await page.getByRole('combobox', { name: 'Account' }).selectOption(cockpitAccountIds.savings);
	await expect(page.locator('.account-history-chart')).toHaveAttribute('data-chart-points', '1');
	await page.getByRole('combobox', { name: 'Account' }).selectOption(cockpitAccountIds.cardC);
	await expect(
		page.getByRole('heading', { name: 'No stood-up history for this account.' })
	).toBeVisible();
	await expect(page.locator('.account-history-chart')).toHaveCount(0);
});

test('Whiteboard remains accessible and contained on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/whiteboard/');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	const dimensions = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
	await expect(page.locator('.history-table tbody tr').first()).toBeVisible();
});
