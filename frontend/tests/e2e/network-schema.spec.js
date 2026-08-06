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

/**
 * Returns the clickable Skeleton switch whose hidden input carries `name`.
 * Skeleton wraps the control in a `<label data-scope="switch">`; clicking that
 * label toggles the switch reliably.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
function switchByName(page, name) {
	return page
		.locator('label[data-scope="switch"]')
		.filter({ has: page.locator(`input[name="${name}"]`) });
}

test.describe('Network schema page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		// Bare /network-schema resolves to the active project's schema.
		await page.goto('/network-schema');
		await page.waitForLoadState('networkidle');
	});

	test('renders the SvelteFlow canvas and the attributes panel', async ({ page }) => {
		// The @xyflow/svelte canvas mounts a .svelte-flow root once initialised.
		await expect(page.locator('.svelte-flow').first()).toBeVisible({ timeout: 15000 });
		// The top-left panel header names the attributes section.
		await expect(page.getByRole('heading', { name: /attributes|eigenschaften/i })).toBeVisible();
	});

	test('the attributes panel exposes the cable name input while expanded', async ({ page }) => {
		// Panel defaults to expanded, so its controls are present on load.
		await expect(page.getByPlaceholder(/name/i).first()).toBeVisible();
	});

	test('collapsing the attributes panel persists the collapsed state', async ({ page }) => {
		await expect.poll(() => readPersisted(page, 'networkSchemaPanelExpanded')).not.toBe(false);

		await page.getByRole('heading', { name: /attributes|eigenschaften/i }).click();

		await expect.poll(() => readPersisted(page, 'networkSchemaPanelExpanded')).toBe(false);
		// Once collapsed, the panel's cable-name input is no longer rendered.
		await expect(page.getByPlaceholder(/name/i)).toHaveCount(0);
	});

	test('toggling edge snapping persists the choice', async ({ page }) => {
		// Snapping defaults to on; toggling it must flip and persist to false.
		await expect.poll(() => readPersisted(page, 'edgeSnappingEnabled')).not.toBe(false);

		await switchByName(page, 'edge-snapping-switch').click();

		await expect.poll(() => readPersisted(page, 'edgeSnappingEnabled')).toBe(false);
	});

	test('toggling cable direction animation persists the choice', async ({ page }) => {
		await expect.poll(() => readPersisted(page, 'cableDirectionAnimationEnabled')).not.toBe(true);

		await switchByName(page, 'cable-direction-animation').click();

		await expect.poll(() => readPersisted(page, 'cableDirectionAnimationEnabled')).toBe(true);
	});

	test('edge snapping choice survives a reload', async ({ page }) => {
		await switchByName(page, 'edge-snapping-switch').click();
		await expect.poll(() => readPersisted(page, 'edgeSnappingEnabled')).toBe(false);

		await page.reload();
		await page.waitForLoadState('networkidle');

		await expect.poll(() => readPersisted(page, 'edgeSnappingEnabled')).toBe(false);
	});
});
