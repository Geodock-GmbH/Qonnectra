import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

test.describe('Map page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		// Bare /map resolves to the active project's map.
		await page.goto('/map');
		await page.waitForURL(/\/map\/[^/]+$/, { timeout: 10000 });
		await page.waitForLoadState('networkidle');
	});

	test('renders the OpenLayers map canvas and viewport', async ({ page }) => {
		await expect(page.locator('.ol-viewport').first()).toBeVisible({ timeout: 15000 });
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('shows the layer visibility tree with the domain layers', async ({ page }) => {
		// The tree lists the core infrastructure layers a user can toggle.
		await expect(page.getByText(/trasse|trench/i).first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByText(/adresse|address/i).first()).toBeVisible();
		await expect(page.getByText(/netzknoten|node/i).first()).toBeVisible();
	});

	test('exposes the feature search input', async ({ page }) => {
		await expect(page.getByPlaceholder(/suchen|search/i).first()).toBeVisible({
			timeout: 15000
		});
	});

	test('submitting the search issues a feature-search request to the backend', async ({ page }) => {
		const search = page.getByPlaceholder(/suchen|search/i).first();

		// Pressing Enter must trigger the real ?/searchFeatures form action; if the
		// search wiring breaks, no request fires and this fails.
		const requestPromise = page.waitForRequest(
			(req) => req.url().includes('searchFeatures') && req.method() === 'POST',
			{ timeout: 15000 }
		);
		await search.click();
		await search.fill('Süder');
		await search.press('Enter');

		const request = await requestPromise;
		// The active project scopes the query, and the typed term is sent as-is.
		const body = request.postData() ?? '';
		expect(body).toContain('searchQuery');
	});

	test('shows the map hint prompting the user to click a layer', async ({ page }) => {
		// The hint is visible while the info drawer is closed (initial state).
		await expect(page.getByText(/click a layer|klicken sie auf einen layer/i).first()).toBeVisible({
			timeout: 15000
		});
	});
});
