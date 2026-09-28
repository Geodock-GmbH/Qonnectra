import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';
import { reloadPage } from './helpers/history.js';
import { gotoProjectRoute, projectPath } from './helpers/routes.js';

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
		await gotoProjectRoute(page, 'network-schema');
		await page.waitForLoadState('networkidle');
	});

	test('clicking a node names it in the URL and opens its drawer; back closes it', async ({
		page
	}) => {
		// The canvas renders its nodes once the schema data arrived, then the
		// drawer loads the node: two backend round trips more than the other tests.
		test.setTimeout(60000);
		await expect(page.locator('.svelte-flow').first()).toBeVisible({ timeout: 15000 });
		// The label box, not a connection handle (which is also a button).
		const nodeLabel = page
			.locator('.svelte-flow__node [role="button"]:not(.svelte-flow__handle)')
			.first();
		// Nodes render once the canvas has its data; give them a moment before deciding to skip.
		await nodeLabel.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
		test.skip((await nodeLabel.count()) === 0, 'Needs at least one node in the schema');

		// Nodes can sit outside the viewport of the canvas; the click handler
		// is what matters here, so dispatch the event directly. Under load the
		// first click can land before the canvas is interactive, so repeat it
		// until the URL names the node.
		await expect
			.poll(
				async () => {
					await nodeLabel.dispatchEvent('click');
					await page.waitForTimeout(500);
					return /[?&]feature=node%3A[0-9a-f-]{36}/.test(page.url());
				},
				{ timeout: 15000 }
			)
			.toBe(true);
		const drawer = page.locator('[data-drawer]');
		await expect(drawer).toBeVisible();
		await expect(drawer.locator('input[name="node_name"], input[name="name"]').first()).toBeVisible(
			{ timeout: 15000 }
		);

		await reloadPage(page);
		await expect(page.locator('[data-drawer]')).toBeVisible({ timeout: 15000 });

		await page.goBack();
		await expect(page).not.toHaveURL(/feature=/);
		await expect(page.locator('[data-drawer]')).not.toBeVisible();
		await expect(page.locator('.svelte-flow').first()).toBeVisible();
	});

	test('the drawer tab carries over between cables and falls back on a node without it', async ({
		page
	}) => {
		test.setTimeout(90000);
		await expect(page.locator('.svelte-flow').first()).toBeVisible({ timeout: 15000 });
		const cableLabels = page.locator('.svelte-flow foreignObject.nopan [role="button"]');
		const nodeLabel = page
			.locator('.svelte-flow__node [role="button"]:not(.svelte-flow__handle)')
			.first();
		await cableLabels
			.nth(1)
			.waitFor({ state: 'attached', timeout: 15000 })
			.catch(() => {});
		await nodeLabel.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
		test.skip(
			(await cableLabels.count()) < 2 || (await nodeLabel.count()) === 0,
			'Needs at least two cables and one node in the schema'
		);

		/**
		 * Clicks a canvas label until the URL names the feature it opens. Labels
		 * can sit outside the canvas viewport or under the drawer, and the first
		 * click can land before the canvas is interactive.
		 * @param {import('@playwright/test').Locator} label
		 * @param {RegExp} expected - What the URL must name afterwards.
		 * @returns {Promise<string>} The `feature` value the URL then carries.
		 */
		const openFrom = async (label, expected) => {
			await expect
				.poll(
					async () => {
						await label.dispatchEvent('click');
						await page.waitForTimeout(500);
						return expected.test(page.url());
					},
					{ timeout: 15000 }
				)
				.toBe(true);
			return new URL(page.url()).searchParams.get('feature') ?? '';
		};

		const drawer = page.locator('[data-drawer]');
		const handlesTab = drawer.getByRole('tab', { name: /^(handles|fangpunkte)$/i });
		const attributesTab = drawer.getByRole('tab', { name: /^(attributes|eigenschaften)$/i });

		const firstCable = await openFrom(cableLabels.first(), /[?&]feature=cable%3A/);
		await handlesTab.click();
		await expect(page).toHaveURL(/[?&]tab=handles/);

		// Several labels can belong to one cable; take the first that opens another.
		let secondCable = firstCable;
		const count = await cableLabels.count();
		for (let index = 1; index < count && secondCable === firstCable; index++) {
			await cableLabels.nth(index).dispatchEvent('click');
			await page.waitForTimeout(500);
			secondCable = new URL(page.url()).searchParams.get('feature') ?? '';
		}
		test.skip(secondCable === firstCable, 'Needs labels of two different cables');
		await expect(page).toHaveURL(/[?&]tab=handles/);
		await expect(handlesTab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });

		await openFrom(nodeLabel, /[?&]feature=node%3A/);
		await expect(attributesTab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
		await expect(handlesTab).toHaveCount(0);
		await expect(page).toHaveURL(/[?&]tab=handles/);

		await openFrom(cableLabels.first(), new RegExp(`feature=${encodeURIComponent(firstCable)}`));
		await expect(handlesTab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
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

	test('the canvas reopens at the remembered pan and zoom and remembers the next one', async ({
		page
	}) => {
		const viewport = page.locator('.svelte-flow__viewport').first();
		/** @returns {Promise<number[]>} x, y and zoom from the canvas transform */
		const shownViewport = async () =>
			((await viewport.evaluate((el) => el.style.transform)).match(/-?[\d.]+/g) ?? []).map(Number);

		await page.evaluate(() =>
			window.localStorage.setItem(
				'networkSchemaViewport',
				JSON.stringify({ x: 137, y: -42, zoom: 0.5 })
			)
		);
		await page.reload();
		await expect(viewport).toBeVisible({ timeout: 15000 });
		await expect.poll(shownViewport).toEqual([137, -42, 0.5]);

		const pane = await page.locator('.svelte-flow__pane').first().boundingBox();
		if (!pane) throw new Error('The schema canvas has no pane');
		await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
		await page.mouse.wheel(0, -400);

		await expect
			.poll(
				async () =>
					/** @type {{ zoom: number }} */ (await readPersisted(page, 'networkSchemaViewport')).zoom
			)
			.toBeGreaterThan(0.5);
		// The canvas transform is serialized with rounded numbers; compare at canvas precision.
		const rounded = (/** @type {number[]} */ values) =>
			values.map((n) => Math.round(n * 100) / 100);
		const shown = rounded(await shownViewport());
		await expect
			.poll(async () => {
				const saved = /** @type {{ x: number, y: number, zoom: number }} */ (
					await readPersisted(page, 'networkSchemaViewport')
				);
				return rounded([saved.x, saved.y, saved.zoom]);
			})
			.toEqual(shown);
	});

	test('edge snapping choice survives a reload', async ({ page }) => {
		await switchByName(page, 'edge-snapping-switch').click();
		await expect.poll(() => readPersisted(page, 'edgeSnappingEnabled')).toBe(false);

		await page.reload();
		await page.waitForLoadState('networkidle');

		await expect.poll(() => readPersisted(page, 'edgeSnappingEnabled')).toBe(false);
	});

	test('client-side navigation into the schema does not trigger a full page reload', async ({
		page
	}) => {
		// Regression: a URL-diffing $effect captured the previous page's URL on
		// mount and fired window.location.reload() on every client-side arrival,
		// making the canvas load twice.
		const id = await gotoProjectRoute(page, 'dashboard');
		await page.waitForLoadState('networkidle');

		// A hard reload replaces the document and wipes this window marker.
		await page.evaluate(() => {
			/** @type {any} */ (window).__reloadCanary = 'alive';
		});

		await page
			.locator(`a[href="${projectPath(id, 'network-schema')}"]`)
			.first()
			.click();
		await expect(page).toHaveURL(new RegExp(`${projectPath(id, 'network-schema')}$`));
		await expect(page.locator('.svelte-flow').first()).toBeVisible({ timeout: 15000 });

		const canary = await page.evaluate(() => /** @type {any} */ (window).__reloadCanary ?? null);
		expect(canary).toBe('alive');
	});
});
