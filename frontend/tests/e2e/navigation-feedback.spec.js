import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

const INDICATOR = '[data-testid="navigation-progress"]';

/**
 * Flags the document as soon as the navigation indicator is attached, so a
 * test can prove it never appeared during a same-route change, however brief.
 * @param {import('@playwright/test').Page} page
 */
async function watchIndicator(page) {
	await page.evaluate((selector) => {
		delete document.body.dataset.navigationProgressSeen;
		new MutationObserver(() => {
			if (document.querySelector(selector)) {
				document.body.dataset.navigationProgressSeen = 'true';
			}
		}).observe(document.body, { childList: true, subtree: true });
	}, INDICATOR);
}

test.describe.configure({ mode: 'serial' });

test.describe('Navigation feedback', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
	});

	test('a search on the conduit page shows no indicator and keeps the input focused', async ({
		page
	}) => {
		await page.goto('/conduit');
		const searchInput = page.locator('[data-testid="search-input"]');
		await expect(searchInput).toBeVisible();
		await page.waitForLoadState('networkidle');
		await watchIndicator(page);

		await searchInput.fill('e2e-navigation');
		await searchInput.press('Enter');

		await expect(page).toHaveURL(/search=e2e-navigation/);
		await expect(searchInput).toBeFocused();
		await expect(page.locator(INDICATOR)).toHaveCount(0);
		await expect(page.locator('body')).not.toHaveAttribute('data-navigation-progress-seen', 'true');
	});

	test('the indicator never intercepts clicks while a route change is pending', async ({
		page
	}) => {
		await page.goto('/dashboard');
		await page.waitForLoadState('networkidle');
		await page.route('**/__data.json*', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});

		await page.locator('a[href="/network-schema"]').first().click();
		const indicator = page.locator(INDICATOR);
		await expect(indicator).toBeVisible();
		await expect(indicator).toHaveCSS('pointer-events', 'none');

		await page.locator('a[href="/conduit"]').first().click();

		await expect(page).toHaveURL(/\/conduit/);
		await expect(indicator).toHaveCount(0);
	});
});
