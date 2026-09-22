import { expect, test } from '@playwright/test';

import { firstFeature } from './helpers/api.js';
import { loginOrSkip } from './helpers/auth.js';
import { gotoProjectRoute, projectIdFromUrl, projectPath } from './helpers/routes.js';

/**
 * Key-behaviour coverage for the routes that are otherwise map/canvas
 * heavy. Each block asserts the page mounts for a real authenticated user and
 * that its most stable, regression-prone control is present and wired.
 */

test.describe('Admin logs page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await page.goto('/admin/logs');
		await page.waitForLoadState('networkidle');
	});

	test('renders the log table with its columns', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /^logs$/i })).toBeVisible();
		const head = page.locator('table thead');
		await expect(head.getByText(/timestamp|zeitstempel|zeit/i).first()).toBeVisible();
		await expect(head.getByText(/level|stufe/i).first()).toBeVisible();
		await expect(head.getByText(/source|quelle/i).first()).toBeVisible();
	});

	test('applying a filter updates the URL query parameters', async ({ page }) => {
		await page
			.getByPlaceholder(/such|search/i)
			.first()
			.fill('e2e-marker-xyz');
		await page
			.getByRole('button', { name: /apply|anwenden|filter/i })
			.first()
			.click();

		await expect(page).toHaveURL(/[?&]search=e2e-marker-xyz/);
		await expect(page).not.toHaveURL(/[?&]page=/);
	});

	test('clearing filters resets the URL back to the base logs route', async ({ page }) => {
		await page
			.getByPlaceholder(/such|search/i)
			.first()
			.fill('temp');
		await page
			.getByRole('button', { name: /apply|anwenden|filter/i })
			.first()
			.click();
		await expect(page).toHaveURL(/[?&]search=temp/);

		await page
			.getByRole('button', { name: /clear|zurücksetzen|löschen/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/admin\/logs$/);
	});
});

test.describe('Post-compaction page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'post-compaction');
		await page.waitForLoadState('networkidle');
	});

	test('renders the page heading and address search field', async ({ page }) => {
		await expect(
			page.getByRole('heading', { name: /post-compaction|nachverdichtung/i })
		).toBeVisible();
		await expect(page.getByPlaceholder(/address|adresse/i).first()).toBeVisible();
	});

	test('the address search field accepts input', async ({ page }) => {
		const search = page.getByPlaceholder(/address|adresse/i).first();
		await search.fill('Hauptstraße');
		await expect(search).toHaveValue('Hauptstraße');
	});
});

test.describe('Pipe-branch page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'pipe-branch');
		await page.waitForLoadState('networkidle');
	});

	test('picking a branch names it in the URL; reload keeps it and back returns', async ({
		page
	}) => {
		const picker = page.getByPlaceholder(/select pipe branch|rohrverzweigung auswählen/i).first();
		await picker.click();
		const option = page.getByRole('option').first();
		test.skip((await option.count()) === 0, 'Needs at least one pipe branch in the project');

		await option.click();

		await expect(page).toHaveURL(/\/pipe-branch\/node\/[0-9a-f-]{36}$/);
		await expect(page.locator('[data-testid="svelte-flow__wrapper"]').first()).toBeVisible({
			timeout: 15000
		});

		await page.reload();
		await expect(page).toHaveURL(/\/pipe-branch\/node\//);
		await expect(page.locator('[data-testid="svelte-flow__wrapper"]').first()).toBeVisible({
			timeout: 15000
		});

		await page.goBack();
		await expect(page).toHaveURL(/\/pipe-branch$/);
	});

	test('renders the SvelteFlow canvas and the branch selector', async ({ page }) => {
		await expect(page.locator('[data-testid="svelte-flow__wrapper"]').first()).toBeVisible({
			timeout: 15000
		});
		// The attributes panel exposes the pipe-branch picker as a combobox input.
		await expect(
			page.getByPlaceholder(/select pipe branch|rohrverzweigung auswählen/i).first()
		).toBeVisible();
	});
});

test.describe('Valuation page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'valuation');
		await page.waitForLoadState('networkidle');
	});

	test('renders the area selection and valuation sections with a map', async ({ page }) => {
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
		await expect(
			page.getByRole('heading', { name: /select area|gebiet auswählen/i })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: /valuation|wertermittlung/i })).toBeVisible();
	});

	test('exposes the area search input', async ({ page }) => {
		await expect(page.locator('[data-testid="search-input"]').first()).toBeVisible({
			timeout: 15000
		});
	});
});

test.describe('House connections page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'house-connections');
		await page.waitForLoadState('networkidle');
	});

	test('renders the map canvas and the search input', async ({ page }) => {
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
		await expect(page.locator('[data-testid="search-input"]').first()).toBeVisible();
	});

	test('a URL naming a trench opens its drawer with the trench title', async ({ page }) => {
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));
		const trench = await firstFeature(page, 'trench', id);
		test.skip(!trench, 'Needs at least one trench in the project');
		const { uuid, label } = /** @type {import('./helpers/api.js').ListedFeature} */ (trench);

		await page.goto(projectPath(id, 'house-connections', { feature: `trench:${uuid}` }));

		const drawer = page.locator('[data-drawer]');
		await expect(drawer).toBeVisible({ timeout: 15000 });
		await expect(drawer.locator('h2')).toHaveText(label);
	});
});
