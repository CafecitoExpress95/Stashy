import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resetTestDatabase } from './database';

const routes = [
	['/', 'Make the money sit-down feel manageable.'],
	['/sit-down/', 'Sit Down'],
	['/archive/', 'Check Archive'],
	['/whiteboard/', 'Visit Whiteboard'],
	['/configuration/accounts/', 'Accounts'],
	['/configuration/data/', 'Backups arrive before the real-data trial.']
] as const;

test('every top-level route supports direct navigation and refresh', async ({ page }) => {
	for (const [path, heading] of routes) {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
		await page.reload();
		await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
	}
});

test('the homepage promotes the completed sit-down cockpit', async ({ page }) => {
	await page.goto('/');
	const sitDownCard = page.getByRole('link', { name: /Sit Down/ });
	await expect(sitDownCard.getByText('Ready now')).toBeVisible();
	await expect(sitDownCard.getByText('Start a sit-down ->')).toBeVisible();
	await expect(sitDownCard.getByText('Coming in Phase 3')).toHaveCount(0);
	const archiveCard = page.getByRole('link', { name: /Check Archive/ });
	await expect(archiveCard.getByText('Ready now')).toBeVisible();
	await expect(archiveCard.getByText('Open Archive ->')).toBeVisible();
	const whiteboardCard = page.getByRole('link', { name: /Visit Whiteboard/ });
	await expect(whiteboardCard.getByText('Ready now')).toBeVisible();
	await expect(whiteboardCard.getByText('Open Whiteboard ->')).toBeVisible();
});

test('the product shell uses approved navigation language', async ({ page }) => {
	await page.goto('/');
	const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
	await expect(navigation.getByRole('link', { name: 'Sit Down' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Check Archive' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Visit Whiteboard' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Accounts' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Save & Restore' })).toBeVisible();
});

test('the shell uses the supplied static branding assets', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('link', { name: 'Stashy home' }).locator('img')).toHaveAttribute(
		'src',
		/logo\.png$/
	);
	await expect(
		page.getByAltText('Stashy squirrel holding an acorn beside stacks of cash')
	).toBeVisible();
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /favicon\.png$/);
});

test('the global error page offers home and retry recovery', async ({ page }) => {
	await page.goto('/not-a-stashy-route/');
	await expect(page.getByRole('heading', { name: 'That page is not in the stash.' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('the shell has no horizontal overflow on desktop or mobile', async ({ page }) => {
	for (const viewport of [
		{ width: 960, height: 800 },
		{ width: 375, height: 812 }
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/');
		const dimensions = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth
		}));
		expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
	}
});

test('launchpad, empty state, error state, and account setup pass Axe', async ({ page }) => {
	await page.goto('/');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	await page.goto('/sit-down/');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	await page.goto('/not-a-stashy-route/');
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

	await resetTestDatabase(page);
	await page.goto('/configuration/accounts/');
	await expect(
		page.getByRole('heading', {
			name: 'Start with the accounts you actually touch during a sit-down.'
		})
	).toBeVisible();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
