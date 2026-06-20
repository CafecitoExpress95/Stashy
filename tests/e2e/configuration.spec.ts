import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { resetTestDatabase } from './database';

async function openCleanAccounts(page: Page): Promise<void> {
	await resetTestDatabase(page);
	await page.goto('/configuration/accounts/');
	await expect(
		page.getByRole('heading', {
			name: 'Start with the accounts you actually touch during a sit-down.'
		})
	).toBeVisible();
}

async function addAccount(
	page: Page,
	name: string,
	type: 'asset' | 'liability' = 'asset'
): Promise<void> {
	await page.getByRole('button', { name: 'Add account' }).first().click();
	await page.getByLabel('Account name').fill(name);
	if (type === 'liability') {
		await page.getByLabel('Liability').check();
	}
	await page.getByRole('button', { name: 'Add account', exact: true }).last().click();
	await expect(page.getByText(`${name} added.`)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await openCleanAccounts(page);
});

test('asset and liability accounts persist after reload', async ({ page }) => {
	await addAccount(page, 'Checking');
	await addAccount(page, 'Card A', 'liability');
	await expect(
		page.locator('section[aria-labelledby="assets-title"]').getByText('Checking', { exact: true })
	).toBeVisible();
	await expect(
		page
			.locator('section[aria-labelledby="liabilities-title"]')
			.getByText('Card A', { exact: true })
	).toBeVisible();

	await page.reload();
	await expect(page.getByText('Checking', { exact: true })).toBeVisible();
	await expect(page.getByText('Card A', { exact: true })).toBeVisible();
});

test('liabilities never expose threshold controls and names remain unique', async ({ page }) => {
	await addAccount(page, 'Checking');
	await page.getByRole('button', { name: 'Add account' }).first().click();
	await page.getByLabel('Liability').check();
	await expect(page.getByLabel('Balance warnings')).toHaveCount(0);
	await page.getByLabel('Account name').fill(' checking ');
	await page.getByRole('button', { name: 'Add account', exact: true }).last().click();
	await expect(
		page.getByText('Account names must be unique, including archived accounts.')
	).toBeVisible();
	await expect(page.getByLabel('Account name')).toHaveValue(' checking ');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('default and custom thresholds validate exact money and ordering', async ({ page }) => {
	await page.getByLabel('Use app defaults').check();
	await page.getByLabel('Warn below').fill('$400.00');
	await page.getByLabel('Danger below').fill('$400.00');
	await page.getByRole('button', { name: 'Save defaults' }).click();
	await expect(page.getByText('Danger must be lower than warning')).toBeVisible();

	await page.getByLabel('Danger below').fill('$100.00');
	await page.getByRole('button', { name: 'Save defaults' }).click();
	await expect(page.getByText('Default thresholds saved.')).toBeVisible();

	await page.getByRole('button', { name: 'Add account' }).first().click();
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Balance warnings').selectOption('custom');
	await page.getByLabel('Warn below').last().fill('$200.00');
	await page.getByLabel('Danger below').last().fill('$50.00');
	await page.getByRole('button', { name: 'Add account', exact: true }).last().click();
	await expect(page.getByText('Custom thresholds', { exact: true })).toBeVisible();
});

test('manual ordering and archive safety survive reload', async ({ page }) => {
	await addAccount(page, 'Card A', 'liability');
	await addAccount(page, 'Card B', 'liability');
	await page.getByRole('button', { name: 'Move Card B up' }).click();
	const liabilityNames = page.locator(
		'section[aria-labelledby="liabilities-title"] .account-summary strong'
	);
	await expect(liabilityNames).toHaveText(['Card B', 'Card A']);

	await page.getByRole('button', { name: 'Archive' }).first().click();
	await page.getByRole('button', { name: 'Archive account' }).click();
	await expect(page.getByRole('heading', { name: 'Archived accounts' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Archived accounts' })).toBeVisible();
	await page.getByRole('button', { name: 'Unarchive' }).click();
	await expect(page.getByRole('heading', { name: 'Archived accounts' })).toHaveCount(0);
});

test('an account can be created with keyboard activation', async ({ page }) => {
	const addButton = page.getByRole('button', { name: 'Add account' }).first();
	await addButton.focus();
	await page.keyboard.press('Enter');
	const nameInput = page.getByLabel('Account name');
	await nameInput.focus();
	await page.keyboard.type('Savings');
	const submit = page.getByRole('button', { name: 'Add account', exact: true }).last();
	await submit.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('Savings', { exact: true })).toBeVisible();
});
