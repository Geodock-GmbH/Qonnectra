import { expect, test } from '@playwright/test';

import { firstFeature } from './helpers/api.js';
import { loginOrSkip, submitLoginForm } from './helpers/auth.js';
import { getProjectId, gotoProjectRoute, projectPath } from './helpers/routes.js';

/** Longer than the keep-alive's fallback interval of seven minutes. */
const PAST_ONE_INTERVAL = '08:00';

const SESSION_EXPIRED = /session expired|sitzung abgelaufen/i;

/**
 * Collects the requests issued from now on whose URL matches, so a test can
 * prove what a keep-alive tick did and did not fetch.
 * @param {import('@playwright/test').Page} page
 * @param {(url: string) => boolean} matches
 * @returns {string[]} The URLs, filled as requests go out.
 */
function recordRequests(page, matches) {
	/** @type {string[]} */
	const urls = [];
	page.on('request', (request) => {
		if (matches(request.url())) urls.push(request.url());
	});
	return urls;
}

/**
 * @param {string} url
 * @returns {boolean} Whether the request is the session keep-alive command.
 */
const isRefresh = (url) => url.includes('/_app/remote/') && url.includes('refreshSession');

/**
 * Runs every timer due within one keep-alive interval, as a tab left open
 * that long would. Needs `page.clock.install()` before the page loaded.
 * @param {import('@playwright/test').Page} page
 */
async function passOneInterval(page) {
	await page.clock.fastForward(PAST_ONE_INTERVAL);
}

test.describe('Session keep-alive', () => {
	test.beforeEach(async ({ page }) => {
		// Real time keeps flowing; the clock only lets a test jump ahead.
		await page.clock.install();
		await loginOrSkip(page, test.skip);
	});

	test('a keep-alive tick refreshes the session without reloading page data', async ({ page }) => {
		test.setTimeout(60000);
		await gotoProjectRoute(page, 'network-schema');
		const flow = page.locator('.svelte-flow').first();
		await expect(flow).toBeVisible({ timeout: 30000 });
		await page.waitForLoadState('networkidle');
		await flow.evaluate((el) => el.setAttribute('data-e2e-mark', 'before-tick'));

		const refreshes = recordRequests(page, isRefresh);
		const dataRequests = recordRequests(page, (url) => url.includes('__data.json'));
		await passOneInterval(page);

		await expect.poll(() => refreshes.length, { timeout: 10000 }).toBe(1);
		await page.waitForLoadState('networkidle');
		expect(dataRequests).toEqual([]);
		await expect(page.locator('.svelte-flow[data-e2e-mark="before-tick"]')).toHaveCount(1);
		await expect(page.getByText(SESSION_EXPIRED)).toHaveCount(0);
	});

	test('an expired session is reported and login returns to the same URL', async ({ page }) => {
		const id = await getProjectId(page);
		const trench = await firstFeature(page, 'trench', id);
		test.skip(!trench, 'Needs a trench in the project');
		const deepLink = projectPath(id, 'map', {
			feature: `trench:${/** @type {{ uuid: string }} */ (trench).uuid}`
		});
		await page.goto(deepLink);
		await page.waitForLoadState('networkidle');

		await page.context().clearCookies();
		await passOneInterval(page);

		await expect(page.getByText(SESSION_EXPIRED).first()).toBeVisible({ timeout: 10000 });
		await expect(page).toHaveURL(/\/login\?redirectTo=/);
		expect(new URL(page.url()).searchParams.get('redirectTo')).toBe(deepLink);

		expect(await submitLoginForm(page)).toBe(true);
		const escaped = deepLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		await expect(page).toHaveURL(new RegExp(`${escaped}(?:#.*)?$`));
	});

	test('after logout no keep-alive tick runs and no expiry is reported', async ({ page }) => {
		await gotoProjectRoute(page, 'address');
		await page.waitForLoadState('networkidle');

		await page.getByRole('button', { name: /logout|abmelden/i }).click();
		await page.waitForURL(/\/login$/);
		// The URL changes before the navigation settles; the form is rendered after.
		await expect(page.locator('input[name="username"]')).toBeVisible();

		const refreshes = recordRequests(page, isRefresh);
		await passOneInterval(page);
		// A tick would fire at once; give its request and toast time to show.
		await page.waitForTimeout(1500);

		expect(refreshes).toEqual([]);
		await expect(page.getByText(SESSION_EXPIRED)).toHaveCount(0);
		await expect(page).toHaveURL(/\/login$/);
	});

	test('a login in the open tab starts the keep-alive', async ({ page }) => {
		// The beforeEach login was a client-side navigation away from /login,
		// so the app never reloaded after the session began. The URL changes
		// before the navigation settles; the landing map is rendered after.
		await expect(page.locator('.ol-viewport').first()).toBeVisible({ timeout: 15000 });
		const refreshes = recordRequests(page, isRefresh);
		await passOneInterval(page);

		await expect.poll(() => refreshes.length, { timeout: 10000 }).toBe(1);
	});
});
