import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';
import { reloadPage } from './helpers/history.js';
import { gotoProjectRoute, projectIdFromUrl, projectPath } from './helpers/routes.js';

/**
 * Locates a dashboard tab trigger by its bilingual (de/en) accessible name.
 * @param {import('@playwright/test').Page} page
 * @param {RegExp} name
 */
function tab(page, name) {
	return page.getByRole('tab', { name });
}

test.describe('Dashboard page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'dashboard');
		await page.waitForLoadState('networkidle');
	});

	test('renders all statistics tabs', async ({ page }) => {
		await expect(tab(page, /overview|übersicht/i)).toBeVisible();
		await expect(tab(page, /trench|trasse/i)).toBeVisible();
		await expect(tab(page, /conduit|rohre/i)).toBeVisible();
		await expect(tab(page, /node|netzknoten/i)).toBeVisible();
		await expect(tab(page, /address|adressen/i)).toBeVisible();
		await expect(tab(page, /area|gebiete/i)).toBeVisible();
	});

	test('overview tab shows the statistic breakdown cards', async ({ page }) => {
		// The overview is the default tab; its cards summarise each domain.
		await expect(page.getByText(/trench statistics|trassenstatistik/i).first()).toBeVisible();
		await expect(page.getByText(/node statistics|netzknotenstatistik/i).first()).toBeVisible();
		await expect(page.getByText(/conduit statistics|rohrstatistiken/i).first()).toBeVisible();
		await expect(page.getByText(/address statistics|adress-statistiken/i).first()).toBeVisible();
	});

	test('switching to the trench tab activates it and changes the panel', async ({ page }) => {
		const overviewMarker = page.getByText(/node statistics|netzknotenstatistik/i).first();
		await expect(overviewMarker).toBeVisible();

		await tab(page, /trench|trasse/i).click();

		await expect(tab(page, /trench|trasse/i)).toHaveAttribute('aria-selected', 'true');
		// The overview-only card is gone once we leave the overview panel.
		await expect(overviewMarker).toHaveCount(0);
	});

	test('the tab lives in the URL: clicks write it, reload keeps it, back skips it', async ({
		page
	}) => {
		await tab(page, /trench|trasse/i).click();
		await expect(page).toHaveURL(/[?&]tab=trench/);
		await tab(page, /node|netzknoten/i).click();
		await expect(page).toHaveURL(/[?&]tab=node/);

		await reloadPage(page);
		await expect(tab(page, /node|netzknoten/i)).toHaveAttribute('aria-selected', 'true', {
			timeout: 15000
		});
		await expect(page.getByText(/nodes by city|netzknoten nach ort/i).first()).toBeVisible();

		// Tab changes are adjustments: back leaves the dashboard instead of
		// replaying the tabs.
		await page.goBack();
		await expect(page).not.toHaveURL(/dashboard/);
	});

	test('a tab the URL names wrongly shows the overview without an error', async ({ page }) => {
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));

		await page.goto(projectPath(id, 'dashboard', { tab: 'nonsense' }));

		await expect(tab(page, /overview|übersicht/i)).toHaveAttribute('aria-selected', 'true', {
			timeout: 15000
		});
		await expect(page.getByText(/trench statistics|trassenstatistik/i).first()).toBeVisible();
	});

	test('each non-overview tab becomes active when clicked', async ({ page }) => {
		for (const name of [
			/conduit|rohre/i,
			/node|netzknoten/i,
			/address|adressen/i,
			/area|gebiete/i
		]) {
			await tab(page, name).click();
			await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
		}
	});
});
