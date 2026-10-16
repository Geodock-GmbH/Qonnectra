import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';
import { gotoProjectRoute } from './helpers/routes.js';

test.describe('Collapsed sidebar on a short window', () => {
	// Too short for every rail icon, as on a laptop with a browser toolbar.
	test.use({ viewport: { width: 1280, height: 520 } });

	test.beforeEach(async ({ page }) => {
		// The user's saved choice from the settings page, read by the persisted store.
		await page.addInitScript(() => localStorage.setItem('isSidebarExpanded', 'false'));
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'dashboard');
	});

	test('scrolls its icons with the mouse wheel and keeps the footer in view', async ({ page }) => {
		const rail = page.locator('[data-scope="navigation"][data-part="root"][data-layout="rail"]');
		await expect(rail).toBeVisible({ timeout: 15000 });
		const links = rail.locator('[data-part="menu"]').first().getByRole('link');
		const footerLinks = rail.locator('[data-part="footer"]').getByRole('link');

		await expect(links.first()).toBeInViewport();
		await expect(links.last()).not.toBeInViewport();

		await links.first().hover();
		// Firefox caps how far one wheel event scrolls, so keep turning the wheel.
		await expect(async () => {
			await page.mouse.wheel(0, 400);
			await expect(links.last()).toBeInViewport({ timeout: 500 });
		}).toPass({ timeout: 10000 });
		await expect(footerLinks.first()).toBeInViewport();
	});
});
