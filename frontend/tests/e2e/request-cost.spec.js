import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

/**
 * Collects every SvelteKit data request issued from now on, so a test can
 * prove a same-route navigation fetched no root layout data.
 * @param {import('@playwright/test').Page} page
 * @returns {import('@playwright/test').Request[]}
 */
function recordDataRequests(page) {
	/** @type {import('@playwright/test').Request[]} */
	const requests = [];
	page.on('request', (request) => {
		if (request.url().includes('__data.json')) requests.push(request);
	});
	return requests;
}

/**
 * Whether a `__data.json` response carries fresh data for the root layout
 * (node 0). A layout that did not rerun is reported as `skip` or omitted.
 * @param {import('@playwright/test').Request} request
 * @returns {Promise<boolean>}
 */
async function carriesRootLayoutData(request) {
	const response = await request.response();
	const body = await response?.json().catch(() => null);
	return body?.nodes?.[0]?.type === 'data';
}

test.describe.configure({ mode: 'serial' });

test.describe('Request cost per navigation', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
	});

	test('a search on the conduit page fetches no root layout data', async ({ page }) => {
		await page.goto('/conduit');
		const searchInput = page.locator('[data-testid="search-input"]');
		await expect(searchInput).toBeVisible();
		await page.waitForLoadState('networkidle');

		const dataRequests = recordDataRequests(page);
		await searchInput.fill('e2e-cost');
		await searchInput.press('Enter');
		await expect(page).toHaveURL(/search=e2e-cost/);
		await page.waitForLoadState('networkidle');

		const withLayoutData = [];
		for (const request of dataRequests) {
			if (await carriesRootLayoutData(request)) withLayoutData.push(request.url());
		}
		expect(withLayoutData).toEqual([]);
	});
});
