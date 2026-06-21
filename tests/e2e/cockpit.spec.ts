import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { cockpitAccountIds, seedCockpitConfiguration } from './database';

function assetCard(page: Page, name: string): Locator {
	return page.locator('article.asset-projection').filter({
		has: page.getByRole('heading', { name, exact: true })
	});
}

function liabilityCard(page: Page, name: string): Locator {
	return page.locator('article.liability-card').filter({
		has: page.getByRole('heading', { name, exact: true })
	});
}

async function enterCanonicalScenario(page: Page): Promise<void> {
	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$1,000.10');
	await assetCard(page, 'Savings').getByLabel('Opening balance').fill('$500.00');

	const cardA = liabilityCard(page, 'Card A');
	await cardA.getByLabel('Account balance').fill('$600.30');
	await cardA.getByLabel('Statement balance').fill('$400.20');
	await cardA.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await cardA.getByLabel('Statement', { exact: true }).check();
	await cardA.getByLabel('Confirmation ID').fill('A-100');

	const cardB = liabilityCard(page, 'Card B');
	await cardB.getByLabel('Account balance').fill('$250.00');
	await cardB.getByLabel('Statement balance').fill('$100.00');
	await cardB.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await cardB.getByLabel('Full balance').check();

	const cardC = liabilityCard(page, 'Card C');
	await cardC.getByLabel('Account balance').fill('$25.00');
	await cardC.getByLabel('Statement balance').fill('$10.00');
	await cardC.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await cardC.getByLabel('Custom').check();
	await cardC.getByLabel('Payment amount').fill('$25.10');
	await cardC.getByLabel('Notes').fill('Intentional ten-cent overpayment');
}

test.beforeEach(async ({ page }) => {
	await seedCockpitConfiguration(page);
	await page.goto('/sit-down/');
	await expect(page.getByRole('heading', { level: 1, name: 'Sit Down' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Source assets' })).toBeVisible();
});

test('canonical scenario calculates immediately and survives explicit draft save', async ({
	page
}) => {
	await enterCanonicalScenario(page);

	const checking = assetCard(page, 'Checking');
	await expect(checking.getByText('$324.80', { exact: true })).toBeVisible();
	await expect(checking.getByText('Warning', { exact: true })).toBeVisible();
	const cardA = liabilityCard(page, 'Card A');
	await expect(cardA.getByText('$400.20', { exact: true })).toBeVisible();
	await expect(cardA.getByText('$200.10', { exact: true })).toBeVisible();
	const cardC = liabilityCard(page, 'Card C');
	await expect(cardC.getByText('-$0.10', { exact: true })).toBeVisible();
	await expect(cardC.getByText('$0.00', { exact: true })).toBeVisible();
	await expect(cardC.getByText('Payment exceeds the starting account balance.')).toBeVisible();

	await page.getByRole('button', { name: 'Save Draft' }).click();
	await expect(page.getByText('Draft saved in this browser.')).toBeVisible();
	await page.reload();
	await expect(page.getByText('Saved draft resumed from this browser.')).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toHaveValue('$1,000.10');
	await expect(liabilityCard(page, 'Card C').getByLabel('Payment amount')).toHaveValue('$25.10');
	await expect(assetCard(page, 'Checking').getByText('$324.80', { exact: true })).toBeVisible();
});

test('full and custom payments remain live and stand-up ready without statement balances', async ({
	page
}) => {
	await enterCanonicalScenario(page);
	const cardB = liabilityCard(page, 'Card B');
	const cardC = liabilityCard(page, 'Card C');
	await cardB.getByLabel('Statement balance').fill('');
	await cardC.getByLabel('Statement balance').fill('');

	await expect(assetCard(page, 'Checking').getByText('$324.80', { exact: true })).toBeVisible();
	await expect(cardB.locator('.remaining-statement strong')).toHaveText('\u2014');
	await expect(cardC.locator('.remaining-statement strong')).toHaveText('\u2014');
	await page.getByRole('button', { name: 'Stand Up' }).click();
	await expect(page.getByText('Ready to stand up', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Save Draft' }).click();
	await page.reload();
	await expect(liabilityCard(page, 'Card B').getByLabel('Statement balance')).toHaveValue('');
	await expect(liabilityCard(page, 'Card C').getByLabel('Statement balance')).toHaveValue('');
});

test('statement mode requires its statement balance and focuses the missing field', async ({
	page
}) => {
	await enterCanonicalScenario(page);
	const cardA = liabilityCard(page, 'Card A');
	await cardA.getByLabel('Statement balance').fill('');
	await page.getByRole('button', { name: 'Stand Up' }).click();

	await expect(cardA.getByLabel('Statement balance')).toBeFocused();
	await expect(cardA.getByText('Enter the statement balance.')).toBeVisible();
});

test('mode and source changes move projections without stale or duplicate subtraction', async ({
	page
}) => {
	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$1,000.10');
	await assetCard(page, 'Savings').getByLabel('Opening balance').fill('$500.00');
	const card = liabilityCard(page, 'Card A');
	await card.getByLabel('Account balance').fill('$600.30');
	await card.getByLabel('Statement balance').fill('$400.20');
	await card.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await card.getByLabel('Full balance').check();
	await expect(assetCard(page, 'Checking').getByText('$399.80', { exact: true })).toBeVisible();

	await card.getByLabel('Statement', { exact: true }).check();
	await expect(assetCard(page, 'Checking').getByText('$599.90', { exact: true })).toBeVisible();
	await card.getByLabel('Pay from').selectOption(cockpitAccountIds.savings);
	await expect(assetCard(page, 'Checking').getByText('$1,000.10', { exact: true })).toBeVisible();
	await expect(assetCard(page, 'Savings').getByText('$99.80', { exact: true })).toBeVisible();

	const beforeNotes = await assetCard(page, 'Savings')
		.locator('.projected-balance strong')
		.textContent();
	await card.getByLabel('Confirmation ID').fill('CONF-123');
	await card.getByLabel('Notes').fill('Pending');
	await expect(assetCard(page, 'Savings').locator('.projected-balance strong')).toHaveText(
		beforeNotes ?? ''
	);
});

test('stand up highlights missing details and accepts complete warning states', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Stand Up' }).click();
	await expect(
		page.getByText('Complete the highlighted payment details before standing up.')
	).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toBeFocused();
	await expect(
		assetCard(page, 'Checking').getByText('Enter an opening balance before standing up.')
	).toBeVisible();

	await enterCanonicalScenario(page);
	await page.getByRole('button', { name: 'Stand Up' }).click();
	await expect(page.getByText(/This sit-down is complete and ready to stand up/)).toBeVisible();
	await expect(page.getByText('Ready to stand up', { exact: true })).toBeVisible();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('mobile keeps projections and actions reachable without horizontal overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Source assets' })).toBeVisible();
	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$100.00');
	const card = liabilityCard(page, 'Card A');
	await card.getByLabel('Account balance').fill('$50.00');
	await card.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await card.getByLabel('Full balance').check();
	await liabilityCard(page, 'Card C').scrollIntoViewIfNeeded();

	const dock = page.getByRole('complementary', { name: 'Live asset projections' });
	await expect(dock).toBeVisible();
	await expect(dock.getByText('$50.00', { exact: true })).toBeVisible();
	const dockPosition = await dock.evaluate((element) => ({
		position: getComputedStyle(element).position,
		top: element.getBoundingClientRect().top
	}));
	expect(dockPosition.position).toBe('sticky');
	expect(dockPosition.top).toBeGreaterThanOrEqual(0);
	expect(dockPosition.top).toBeLessThan(24);
	await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
	const dimensions = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
