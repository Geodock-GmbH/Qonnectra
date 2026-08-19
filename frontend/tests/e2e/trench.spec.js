import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

/**
 * Reads a persisted store value out of localStorage the way the `persisted`
 * store writes it (JSON-encoded under the given key).
 * @param {import('@playwright/test').Page} page
 * @param {string} key
 * @returns {Promise<unknown>}
 */
async function readPersisted(page, key) {
	return page.evaluate((/** @type {string} */ k) => {
		const raw = window.localStorage.getItem(k);
		return raw === null ? null : JSON.parse(raw);
	}, key);
}

test.describe('Trench (conduit assignment) page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await page.goto('/trench');
		await page.waitForLoadState('networkidle');
	});

	test('renders the map area and the mode toggle controls', async ({ page }) => {
		// The routing-mode and linked-trenches switches are the page's primary controls.
		await expect(page.locator('input[name="routing-mode"]')).toBeAttached();
		await expect(page.locator('input[name="show-linked-trenches"]')).toBeAttached();
		// OpenLayers renders its viewport as a canvas inside the map container.
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
	});

	test('shows the "assign a conduit" hint while no conduit is selected', async ({ page }) => {
		// On load no conduit is selected, so the hint must guide the user.
		await expect(page.getByText(/select a conduit|wählen sie ein rohr/i).first()).toBeVisible({
			timeout: 15000
		});
	});

	test('toggling routing mode persists the choice', async ({ page }) => {
		await expect.poll(() => readPersisted(page, 'routingMode')).not.toBe(true);

		// The switch is wrapped in a clickable label carrying the routing-mode title.
		await page
			.locator('label', { hasText: /routing|routing-modus/i })
			.first()
			.click();

		await expect.poll(() => readPersisted(page, 'routingMode')).toBe(true);
	});

	test('toggling show-linked-trenches persists the choice', async ({ page }) => {
		await expect.poll(() => readPersisted(page, 'showLinkedTrenches')).not.toBe(true);

		await page
			.locator('label', { hasText: /linked trenches|trassenverbindungen/i })
			.first()
			.click();

		await expect.poll(() => readPersisted(page, 'showLinkedTrenches')).toBe(true);
	});

	test('routing mode persists across a reload', async ({ page }) => {
		await page
			.locator('label', { hasText: /routing|routing-modus/i })
			.first()
			.click();
		await expect.poll(() => readPersisted(page, 'routingMode')).toBe(true);

		await page.reload();
		await page.waitForLoadState('networkidle');

		// The store rehydrates from localStorage, so the value survives the reload.
		await expect.poll(() => readPersisted(page, 'routingMode')).toBe(true);
	});
});
