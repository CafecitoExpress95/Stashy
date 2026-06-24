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
	await cardA.getByRole('button', { name: 'Statement' }).click();
	await cardA.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await cardA.getByLabel('Confirmation ID').fill('A-100');

	const cardB = liabilityCard(page, 'Card B');
	await cardB.getByLabel('Account balance').fill('$250.00');
	await cardB.getByLabel('Statement balance').fill('$100.00');
	await cardB.getByRole('button', { name: 'Full balance' }).click();
	await cardB.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);

	const cardC = liabilityCard(page, 'Card C');
	await cardC.getByLabel('Account balance').fill('$25.00');
	await cardC.getByLabel('Statement balance').fill('$10.00');
	await cardC.getByRole('button', { name: 'Custom' }).click();
	await cardC.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await cardC.getByLabel('Payment amount').fill('$25.10');
	await cardC.getByLabel('Notes').fill('Intentional ten-cent overpayment');
}

async function confirmStandUp(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Stand Up' }).click();
	const dialog = page.getByRole('dialog', { name: 'Ready to stand up?' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Confirm Stand Up' }).click();
	await expect(page.getByRole('heading', { name: 'You stood up.' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await seedCockpitConfiguration(page);
	await page.goto('/sit-down/');
	await expect(page.getByRole('heading', { level: 1, name: 'Sit Down' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Source assets' })).toBeVisible();
});

test('valid edits autosave and resume after reload', async ({ page }) => {
	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$100.10');
	await expect(page.getByText('All changes autosaved in this browser.')).toBeVisible();
	await page.reload();
	await expect(page.getByText('Saved draft resumed from this browser.')).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toHaveValue('$100.10');
});

test('canonical scenario saves explicitly and stands up into a durable receipt', async ({
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
	await confirmStandUp(page);
	const nextSitDownAction = page.getByRole('button', { name: 'Start New Sit-Down' });
	await expect(nextSitDownAction).toBeVisible();
	const receiptOrder = await page.evaluate(() => {
		const action = document.querySelector('.receipt-actions');
		const details = document.querySelector('.session-replay-details');
		return action && details
			? action.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING
			: 0;
	});
	expect(receiptOrder).toBeTruthy();
	await expect(page.getByRole('heading', { name: 'Asset snapshots' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Liability payments' })).toBeVisible();
	await expect(page.getByText('$324.80', { exact: true })).toBeVisible();
	await expect(page.getByText('Intentional ten-cent overpayment')).toBeVisible();

	await page.reload();
	await expect(page.getByRole('heading', { name: 'You stood up.' })).toBeVisible();
	await expect(page.getByText('A-100', { exact: true })).toBeVisible();
	await expect(page.getByText('Not recorded', { exact: true }).first()).toBeVisible();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('full and custom payments stand up without statement balances', async ({ page }) => {
	await enterCanonicalScenario(page);
	const cardB = liabilityCard(page, 'Card B');
	const cardC = liabilityCard(page, 'Card C');
	await cardB.getByLabel('Statement balance').fill('');
	await cardC.getByLabel('Statement balance').fill('');

	await expect(assetCard(page, 'Checking').getByText('$324.80', { exact: true })).toBeVisible();
	await expect(cardB.locator('.remaining-statement strong')).toHaveText('—');
	await expect(cardC.locator('.remaining-statement strong')).toHaveText('—');
	await confirmStandUp(page);
	await expect(page.getByText('Not recorded', { exact: true }).first()).toBeVisible();
});

test('no-payment rows stand up without source assets or projection changes', async ({ page }) => {
	const firstCard = liabilityCard(page, 'Card A');
	await expect(firstCard.getByLabel('No source needed')).toBeDisabled();
	await expect(firstCard.getByText('$0.00', { exact: true })).toBeVisible();
	await expect(firstCard.getByRole('button', { name: 'Full balance' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$1,000.10');
	await assetCard(page, 'Savings').getByLabel('Opening balance').fill('$500.00');
	for (const name of ['Card A', 'Card B', 'Card C']) {
		const card = liabilityCard(page, name);
		await card.getByLabel('Account balance').fill('$123.45');
		await card.getByLabel('Statement balance').fill('$100.00');
		await expect(card.getByLabel('No source needed')).toBeDisabled();
	}

	await expect(assetCard(page, 'Checking').getByText('$1,000.10', { exact: true })).toBeVisible();
	await confirmStandUp(page);
	await expect(page.getByText('No payment', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('No source — not paying', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('$0.00', { exact: true }).first()).toBeVisible();
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
	await expect(page.getByRole('dialog', { name: 'Ready to stand up?' })).toBeHidden();
});

test('mode and source changes move projections without stale or duplicate subtraction', async ({
	page
}) => {
	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$1,000.10');
	await assetCard(page, 'Savings').getByLabel('Opening balance').fill('$500.00');
	const card = liabilityCard(page, 'Card A');
	await card.getByLabel('Account balance').fill('$600.30');
	await card.getByLabel('Statement balance').fill('$400.20');
	await card.getByRole('button', { name: 'Full balance' }).click();
	await card.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
	await expect(assetCard(page, 'Checking').getByText('$399.80', { exact: true })).toBeVisible();

	await card.getByRole('button', { name: 'Statement' }).click();
	await expect(assetCard(page, 'Checking').getByText('$599.90', { exact: true })).toBeVisible();
	await card.getByLabel('Pay from').selectOption(cockpitAccountIds.savings);
	await expect(assetCard(page, 'Checking').getByText('$1,000.10', { exact: true })).toBeVisible();
	await expect(assetCard(page, 'Savings').getByText('$99.80', { exact: true })).toBeVisible();

	await card.getByRole('button', { name: 'Statement' }).click();
	await expect(card.getByLabel('No source needed')).toBeDisabled();
	await expect(assetCard(page, 'Savings').getByText('$500.00', { exact: true })).toBeVisible();
	await card.getByRole('button', { name: 'Full balance' }).click();
	await expect(card.getByLabel('Pay from')).toHaveValue('');
});

test('invalid text pauses autosave without replacing the last valid draft', async ({ page }) => {
	const opening = assetCard(page, 'Checking').getByLabel('Opening balance');
	await opening.fill('$100.00');
	await expect(page.getByText('All changes autosaved in this browser.')).toBeVisible();
	await opening.fill('$100.001');
	await expect(page.getByText('Autosave paused', { exact: true })).toBeVisible();
	await expect(page.getByText(/last valid draft is safe/)).toBeVisible();

	await page.reload();
	await expect(opening).toHaveValue('$100.00');
});

test('a failed write is visible and leaves current entries available to retry', async ({
	page
}) => {
	await page.evaluate(() => {
		const originalPut = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
			if (this.name === 'sessions') throw new Error('Simulated storage failure.');
			return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
		};
	});
	const opening = assetCard(page, 'Checking').getByLabel('Opening balance');
	await opening.fill('$123.45');
	await page.getByRole('button', { name: 'Save Draft' }).click();
	await expect(page.getByText(/Simulated storage failure/)).toBeVisible();
	await expect(page.getByText(/current entries are still on screen/)).toBeVisible();
	await expect(opening).toHaveValue('$123.45');
});

test('active saved drafts can be discarded into a fresh unsaved sit-down', async ({ page }) => {
	await assetCard(page, 'Checking').getByLabel('Opening balance').fill('$100.10');
	await expect(page.getByText('All changes autosaved in this browser.')).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Discard Draft' }).click();
	await expect(page.getByText('Draft discarded. Fresh sit-down ready')).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toHaveValue('');
	await page.reload();
	await expect(
		page.getByText('New sit-down. Autosave begins after your first valid edit.')
	).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toHaveValue('');
});

test('starting a new sit-down persists a distinct blank draft', async ({ page }) => {
	await enterCanonicalScenario(page);
	await confirmStandUp(page);
	await page.getByRole('button', { name: 'Start New Sit-Down' }).click();
	await expect(page.getByText('New blank draft saved in this browser.')).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toHaveValue('');
	await page.reload();
	await expect(page.getByText('Saved draft resumed from this browser.')).toBeVisible();
	await expect(assetCard(page, 'Checking').getByLabel('Opening balance')).toHaveValue('');
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
	await card.getByRole('button', { name: 'Full balance' }).click();
	await card.getByLabel('Pay from').selectOption(cockpitAccountIds.checking);
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
