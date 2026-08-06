import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

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
		await expect(page).toHaveURL(/[?&]page=1/);
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
		await page.goto('/post-compaction');
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
		await page.goto('/pipe-branch');
		await page.waitForURL(/\/pipe-branch\/[^/]+$/, { timeout: 10000 });
		await page.waitForLoadState('networkidle');
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
		await page.goto('/valuation');
		await page.waitForURL(/\/valuation\/[^/]+$/, { timeout: 10000 });
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
		await page.goto('/house-connections');
		await page.waitForURL(/\/house-connections\/[^/]+$/, { timeout: 10000 });
		await page.waitForLoadState('networkidle');
	});

	test('renders the map canvas and the search input', async ({ page }) => {
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
		await expect(page.locator('[data-testid="search-input"]').first()).toBeVisible();
	});
});
