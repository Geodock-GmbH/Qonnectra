import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

test.describe('Map page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		// Bare /map resolves to the active project's map.
		await page.goto('/map');
		await page.waitForURL(/\/map\/[^/]+$/, { timeout: 10000 });
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
		const projectIdInUrl = () => new URL(page.url()).pathname.split('/')[2];

		const firstProjectLabel = (await input.inputValue()).trim();
		const firstProjectOption = new RegExp(
			`^\\s*${firstProjectLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`
		);
		const firstProjectId = projectIdInUrl();

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
		await page.waitForURL((url) => url.pathname.split('/')[2] !== firstProjectId);
		const secondProjectId = projectIdInUrl();

		await expect
			.poll(() => tilesFor(secondProjectId).length, { timeout: 15000 })
			.toBeGreaterThan(0);
		// The map must switch once; bouncing back to the old project mid-switch is
		// what used to abort in-flight tiles and stall the map's tile queue.
		expect(tilesFor(firstProjectId)).toHaveLength(0);

		tileRequests.length = 0;
		await trigger.click();
		await options.filter({ hasText: firstProjectOption }).first().click();
		await page.waitForURL((url) => url.pathname.split('/')[2] === firstProjectId);

		await expect.poll(() => tilesFor(firstProjectId).length, { timeout: 15000 }).toBeGreaterThan(0);
		expect(tilesFor(secondProjectId)).toHaveLength(0);
	});

	test('shows the map hint prompting the user to click a layer', async ({ page }) => {
		// The hint is visible while the info drawer is closed (initial state).
		await expect(page.getByText(/click a layer|klicken sie auf einen layer/i).first()).toBeVisible({
			timeout: 15000
		});
	});
});
