import { expect, test } from '@playwright/test';

/** @typedef {import('./helpers/api.js').ListedFeature} ListedFeature */

import { firstFeature } from './helpers/api.js';
import { loginOrSkip } from './helpers/auth.js';
import { gotoProjectRoute, projectIdFromUrl, projectPath } from './helpers/routes.js';

test.describe('Map page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'map');
		await page.waitForLoadState('networkidle');
	});

	test('renders the OpenLayers map canvas and viewport', async ({ page }) => {
		await expect(page.locator('.ol-viewport').first()).toBeVisible({ timeout: 15000 });
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('shows the layer visibility tree with the domain layers', async ({ page }) => {
		// The tree lists the core infrastructure layers a user can toggle.
		await expect(page.getByText(/trasse|trench/i).first()).toBeVisible({ timeout: 15000 });
		await expect(page.getByText(/adresse|address/i).first()).toBeVisible();
		await expect(page.getByText(/netzknoten|node/i).first()).toBeVisible();
	});

	test('exposes the feature search input', async ({ page }) => {
		await expect(page.getByPlaceholder(/suchen|search/i).first()).toBeVisible({
			timeout: 15000
		});
	});

	test('submitting the search issues a feature-search request to the backend', async ({ page }) => {
		const search = page.getByPlaceholder(/suchen|search/i).first();

		// Pressing Enter must call the real searchFeatures remote query; if the
		// search wiring breaks, no request fires and this fails.
		const requestPromise = page.waitForRequest(
			(req) => req.url().includes('/_app/remote/') && req.url().includes('searchFeatures'),
			{ timeout: 15000 }
		);
		await search.click();
		await search.fill('Süder');
		await search.press('Enter');

		const request = await requestPromise;
		// Queries travel as GET requests carrying their argument in the payload.
		expect(request.method()).toBe('GET');
		expect(new URL(request.url()).searchParams.get('payload')).toBeTruthy();
	});

	test('shows the global view toggle after a hard page load', async ({ page }) => {
		// beforeEach reached the map through page.goto, i.e. a server-rendered load.
		await expect(
			page.getByRole('button', { name: /alle projekte anzeigen|view all projects/i })
		).toBeVisible({ timeout: 15000 });
	});

	test('switching the project loads the new project and switching back reloads the first', async ({
		page
	}) => {
		await expect(page.locator('.ol-viewport').first()).toBeVisible({ timeout: 15000 });

		const input = page.locator('[data-scope="combobox"][data-part="input"]').first();
		const trigger = page.locator('[data-scope="combobox"][data-part="trigger"]').first();
		const options = page.locator('[data-scope="combobox"][data-part="item"]:visible');
		const projectIdInUrl = () => projectIdFromUrl(page.url());

		const firstProjectLabel = (await input.inputValue()).trim();
		const firstProjectOption = new RegExp(
			`^\\s*${firstProjectLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`
		);
		const firstProjectId = /** @type {string} */ (projectIdInUrl());

		await trigger.click();
		const otherProject = options.filter({ hasNotText: firstProjectOption }).first();
		test.skip((await otherProject.count()) === 0, 'Needs at least two active projects');

		/** @type {string[]} */
		const tileRequests = [];
		page.on('request', (req) => {
			if (req.url().includes('.mvt')) tileRequests.push(req.url());
		});
		/** @param {string} projectId */
		const tilesFor = (projectId) =>
			tileRequests.filter((url) => new URL(url).searchParams.get('project') === projectId);

		await otherProject.click();
		await page.waitForURL((url) => projectIdFromUrl(url.href) !== firstProjectId);
		const secondProjectId = /** @type {string} */ (projectIdInUrl());

		await expect
			.poll(() => tilesFor(secondProjectId).length, { timeout: 15000 })
			.toBeGreaterThan(0);
		// The map must switch once; bouncing back to the old project mid-switch is
		// what used to abort in-flight tiles and stall the map's tile queue.
		expect(tilesFor(firstProjectId)).toHaveLength(0);

		tileRequests.length = 0;
		await trigger.click();
		await options.filter({ hasText: firstProjectOption }).first().click();
		await page.waitForURL((url) => projectIdFromUrl(url.href) === firstProjectId);

		await expect.poll(() => tilesFor(firstProjectId).length, { timeout: 15000 }).toBeGreaterThan(0);
		expect(tilesFor(secondProjectId)).toHaveLength(0);

		// The map follows the URL alone: browser back returns to the second
		// project and its tiles without anyone touching the picker.
		tileRequests.length = 0;
		await page.goBack();
		await page.waitForURL((url) => projectIdFromUrl(url.href) === secondProjectId);

		await expect
			.poll(() => tilesFor(secondProjectId).length, { timeout: 15000 })
			.toBeGreaterThan(0);
		expect(tilesFor(firstProjectId)).toHaveLength(0);
	});

	test('a URL naming a trench opens its drawer; reload keeps it and back closes it', async ({
		page
	}) => {
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));
		const trench = await firstFeature(page, 'trench', id);
		test.skip(!trench, 'Needs at least one trench in the project');
		const uuid = /** @type {ListedFeature} */ (trench).uuid;

		await page.goto(projectPath(id, 'map', { feature: `trench:${uuid}` }));

		const drawer = page.locator('[data-drawer]');
		await expect(drawer).toBeVisible({ timeout: 15000 });
		// The drawer fetched the trench itself: the title is its id.
		await expect(drawer.locator('h2')).toHaveText(/** @type {ListedFeature} */ (trench).label);

		await page.reload();
		await expect(page.locator('[data-drawer]')).toBeVisible({ timeout: 15000 });

		await page.goBack();
		await expect(page).not.toHaveURL(/feature=/);
		await expect(page.locator('[data-drawer]')).not.toBeVisible();
		await expect(page.locator('.ol-viewport').first()).toBeVisible();
	});

	test('a URL naming a trench and a tab opens the drawer on that tab', async ({ page }) => {
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));
		const trench = await firstFeature(page, 'trench', id);
		test.skip(!trench, 'Needs at least one trench in the project');
		const uuid = /** @type {ListedFeature} */ (trench).uuid;

		await page.goto(projectPath(id, 'map', { feature: `trench:${uuid}`, tab: 'cables' }));

		const drawer = page.locator('[data-drawer]');
		await expect(drawer).toBeVisible({ timeout: 15000 });
		await expect(drawer.getByRole('tab', { name: /cable|kabel/i })).toHaveAttribute(
			'aria-selected',
			'true',
			{ timeout: 15000 }
		);
	});

	test('panning writes the view into the hash without a navigation or a history entry', async ({
		page
	}) => {
		const viewport = page.locator('.ol-viewport').first();
		await expect(viewport).toBeVisible({ timeout: 15000 });
		await expect(page).toHaveURL(/#map=[\d.]+\/-?\d+\/-?\d+$/, { timeout: 15000 });
		const before = page.url();
		const historyLength = await page.evaluate(() => history.length);
		/** @type {string[]} */
		const appRequests = [];
		const origin = new URL(page.url()).origin;
		page.on('request', (req) => {
			if (req.url().startsWith(origin)) appRequests.push(req.url());
		});

		const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (
			await viewport.boundingBox()
		);
		const startX = box.x + box.width / 2;
		const startY = box.y + box.height / 2;
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(startX + 120, startY + 80, { steps: 8 });
		await page.mouse.up();

		await expect.poll(() => page.url(), { timeout: 5000 }).not.toBe(before);
		expect(page.url()).toMatch(/#map=[\d.]+\/-?\d+\/-?\d+$/);
		expect(await page.evaluate(() => history.length)).toBe(historyLength);
		expect(appRequests).toHaveLength(0);
	});

	test('a copied URL opens at the same view, and closing a drawer keeps it', async ({ page }) => {
		await expect(page).toHaveURL(/#map=/, { timeout: 15000 });
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));
		const viewport = page.locator('.ol-viewport').first();
		const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (
			await viewport.boundingBox()
		);
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2 - 40, { steps: 6 });
		await page.mouse.up();
		await expect.poll(() => page.url(), { timeout: 5000 }).toMatch(/#map=/);
		const hash = new URL(page.url()).hash;

		// A recipient opening the copied URL lands on the same view.
		await page.goto(page.url());
		await expect(page.locator('.ol-viewport').first()).toBeVisible({ timeout: 15000 });
		await expect.poll(() => new URL(page.url()).hash, { timeout: 15000 }).toBe(hash);

		// Opening and closing a drawer never drops the view.
		const trench = await firstFeature(page, 'trench', id);
		test.skip(!trench, 'Needs at least one trench in the project');
		const uuid = /** @type {ListedFeature} */ (trench).uuid;
		await page.goto(`${projectPath(id, 'map', { feature: `trench:${uuid}` })}${hash}`);
		await expect(page.locator('[data-drawer]')).toBeVisible({ timeout: 15000 });
		await page
			.locator('[data-drawer]')
			.getByLabel(/Close drawer|Seitenleiste schließen/i)
			.click();
		await expect(page).not.toHaveURL(/feature=/);
		expect(new URL(page.url()).hash).toBe(hash);
	});

	test('shows the map hint prompting the user to click a layer', async ({ page }) => {
		// The hint is visible while the info drawer is closed (initial state).
		await expect(page.getByText(/click a layer|klicken sie auf einen layer/i).first()).toBeVisible({
			timeout: 15000
		});
	});
});
