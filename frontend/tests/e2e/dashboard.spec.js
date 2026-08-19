import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

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
		await page.goto('/dashboard');
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
