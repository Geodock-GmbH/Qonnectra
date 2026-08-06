import { expect, test } from '@playwright/test';

import { loginOrSkip, TEST_USERNAME } from './helpers/auth.js';

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

test.describe('Settings page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
	});

	test('shows the logged-in username in the user section', async ({ page }) => {
		// The account section renders the real authenticated user, not a placeholder.
		await expect(page.getByText(/** @type {string} */ (TEST_USERNAME))).toBeVisible();
	});

	test('renders the map style controls with named color inputs', async ({ page }) => {
		await expect(page.locator('input[name="trench-color"]')).toBeVisible();
		await expect(page.locator('input[name="trench-color-selected"]')).toBeVisible();
		// Radio group that switches trench styling strategy.
		await expect(page.locator('input[name="trench-style-mode"][value="none"]')).toBeVisible();
		await expect(page.locator('input[name="trench-style-mode"][value="surface"]')).toBeVisible();
	});

	test('changing the trench color persists it to localStorage', async ({ page }) => {
		const colorInput = page.locator('input[name="trench-color"]');
		await colorInput.fill('#123456');
		// The bound store mirrors the input immediately; verify the persisted layer.
		await expect.poll(() => readPersisted(page, 'trenchColor')).toBe('#123456');
	});

	test('the trench color reset button restores the default and persists it', async ({ page }) => {
		const colorInput = page.locator('input[name="trench-color"]');
		await colorInput.fill('#654321');
		await expect.poll(() => readPersisted(page, 'trenchColor')).toBe('#654321');

		await page.locator('button[name="reset-trench-color"]').click();

		const persisted = await readPersisted(page, 'trenchColor');
		expect(persisted).not.toBe('#654321');
		// The input reflects the restored default, so the two agree.
		await expect(colorInput).toHaveValue(/** @type {string} */ (persisted));
	});

	test('switching trench style mode to surface reveals the surface styles section', async ({
		page
	}) => {
		const surfaceRadio = page.locator('input[name="trench-style-mode"][value="surface"]');

		// The surface-styles block is conditional on the selected mode.
		const surfaceHeading = page.getByRole('heading', { name: /surface styles|oberflächen/i });
		await expect(surfaceHeading).toHaveCount(0);

		await surfaceRadio.check();

		await expect(page.locator('input[name="trench-style-mode"][value="surface"]')).toBeChecked();
		await expect.poll(() => readPersisted(page, 'trenchStyleMode')).toBe('surface');
	});

	test('trench style mode persists across a reload', async ({ page }) => {
		await page.locator('input[name="trench-style-mode"][value="construction_type"]').check();
		await expect.poll(() => readPersisted(page, 'trenchStyleMode')).toBe('construction_type');

		await page.reload();
		await page.waitForLoadState('networkidle');

		await expect(
			page.locator('input[name="trench-style-mode"][value="construction_type"]')
		).toBeChecked();
	});

	test('cable edge color mode selection persists', async ({ page }) => {
		await page.locator('input[name="cable-edge-color-mode"][value="linked"]').check();
		await expect(page.locator('input[name="cable-edge-color-mode"][value="linked"]')).toBeChecked();
		await expect.poll(() => readPersisted(page, 'cableEdgeColorMode')).toBe('linked');
	});
});
