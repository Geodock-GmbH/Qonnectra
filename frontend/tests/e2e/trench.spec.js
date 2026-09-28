import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';
import { getProjectId, projectPath } from './helpers/routes.js';

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
		const id = await getProjectId(page);
		// A URL without a flag is rewritten to the preferred flag (flag 1 by
		// default), so the page always settles on /trench/<flagId>.
		await page.goto(projectPath(id, 'trench'));
		await expect(page).toHaveURL(/\/trench\/[^/?#]+(?:#.*)?$/);
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

test.describe('Trench page reached through the sidebar', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
	});

	test('opens the conduit dropdown right under its input after a client-side visit', async ({
		page
	}) => {
		const id = await getProjectId(page);
		// The dashboard loads no map, so the trench map is still loading its
		// styles when the page renders; a navigation in that window (a redirect
		// to the preferred flag) makes Svelte drop the conduit picker's effects.
		await page.goto(projectPath(id, 'dashboard'));
		await page.waitForLoadState('networkidle');

		await page
			.getByRole('link', { name: /^(connections|zuordnung)$/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/trench\/[^/?#]+(?:#.*)?$/);

		const input = page.getByPlaceholder(/select conduit|rohr auswählen/i);
		await expect(input).toBeVisible({ timeout: 15000 });

		await input.click();
		await expect(input).toHaveAttribute('aria-expanded', 'true');

		const listbox = page.locator(`#${await input.getAttribute('aria-controls')}`);
		await expect(listbox.getByRole('option').first()).toBeVisible();

		// A dropdown whose position was never measured sits at 0/0 with no width.
		const inputBox = await input.boundingBox();
		const listBox = await listbox.boundingBox();
		expect(inputBox).not.toBeNull();
		expect(listBox).not.toBeNull();
		if (!inputBox || !listBox) return;
		expect(listBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height);
		expect(Math.abs(listBox.x - inputBox.x)).toBeLessThan(4);
		expect(Math.abs(listBox.width - inputBox.width)).toBeLessThan(4);
	});
});
