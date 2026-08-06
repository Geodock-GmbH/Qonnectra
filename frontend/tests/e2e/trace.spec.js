import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

test.describe('Fiber trace search page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await page.goto('/trace');
		await page.waitForLoadState('networkidle');
	});

	test('renders all five trace-type tabs and the search hint', async ({ page }) => {
		// One button per traceable entity type.
		await expect(page.locator('button[title]')).toHaveCount(5);
		// With an empty query the page prompts for at least two characters.
		await expect(page.getByText(/at least 2|mindestens 2 zeichen/i).first()).toBeVisible();
	});

	test('the address tab shows the address search placeholder by default', async ({ page }) => {
		await expect(page.getByPlaceholder(/street, city|straße, stadt/i).first()).toBeVisible();
	});

	test('switching to the node tab changes the search placeholder', async ({ page }) => {
		await page
			.locator('button[title]')
			.filter({ hasText: /node|netzknoten/i })
			.first()
			.click();

		await expect(page.getByPlaceholder(/node name|netzknotenname/i).first()).toBeVisible();
	});

	test('typing a query issues a trace-search request to the backend', async ({ page }) => {
		const search = page.getByPlaceholder(/street, city|straße, stadt/i).first();

		const requestPromise = page.waitForRequest(
			(req) => req.url().includes('trace-search') && req.url().includes('type=address'),
			{ timeout: 15000 }
		);
		await search.fill('Süder');
		const request = await requestPromise;

		// The query and active type are both encoded in the search URL.
		expect(request.url()).toContain('search=S');
	});

	test('a matching search shows selectable result rows', async ({ page }) => {
		const search = page.getByPlaceholder(/street, city|straße, stadt/i).first();
		await search.fill('Süder');

		// The debounced backend search populates a scrollable results list.
		const results = page.locator('div.max-h-80 button');
		await expect(results.first()).toBeVisible({ timeout: 15000 });
	});

	test('clicking a result navigates to the address trace detail page', async ({ page }) => {
		const search = page.getByPlaceholder(/street, city|straße, stadt/i).first();
		await search.fill('Süder');

		const firstResult = page.locator('div.max-h-80 button').first();
		await expect(firstResult).toBeVisible({ timeout: 15000 });
		await firstResult.click();

		await page.waitForURL(/\/trace\/address\/[0-9a-f-]{36}/, { timeout: 10000 });
	});

	test('enabling "include geometry" reveals the geometry mode selector', async ({ page }) => {
		const geometryToggle = page.getByText(/include geometry|geometrie einbeziehen/i).first();

		// The mode selector is hidden until geometry is opted in.
		await expect(page.getByText(/^mode$|modus/i)).toHaveCount(0);

		await geometryToggle.click();

		await expect(page.getByText(/mode|modus/i).first()).toBeVisible();
	});

	test('a non-matching query shows the no-results message', async ({ page }) => {
		const search = page.getByPlaceholder(/street, city|straße, stadt/i).first();
		await search.fill('zzz-nonexistent-street-zzz');

		await expect(page.getByText(/no results|keine ergebnisse/i).first()).toBeVisible({
			timeout: 15000
		});
	});
});
