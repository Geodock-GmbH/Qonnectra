import { expect, test } from '@playwright/test';

import { firstFeature } from './helpers/api.js';
import { loginOrSkip } from './helpers/auth.js';
import { gotoProjectRoute, projectIdFromUrl, projectPath } from './helpers/routes.js';

/**
 * Key-behaviour coverage for the routes that are otherwise map/canvas
 * heavy. Each block asserts the page mounts for a real authenticated user and
 * that its most stable, regression-prone control is present and wired.
 */

test.describe('Admin logs page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await page.goto('/admin/logs');
		await page.waitForLoadState('networkidle');
	});

	test('renders the log table with its columns', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /^logs$/i })).toBeVisible();
		const head = page.locator('table thead');
		await expect(head.getByText(/timestamp|zeitstempel|zeit/i).first()).toBeVisible();
		await expect(head.getByText(/level|stufe/i).first()).toBeVisible();
		await expect(head.getByText(/source|quelle/i).first()).toBeVisible();
	});

	test('applying a filter updates the URL query parameters', async ({ page }) => {
		await page
			.getByPlaceholder(/such|search/i)
			.first()
			.fill('e2e-marker-xyz');
		await page
			.getByRole('button', { name: /apply|anwenden|filter/i })
			.first()
			.click();

		await expect(page).toHaveURL(/[?&]search=e2e-marker-xyz/);
		await expect(page).not.toHaveURL(/[?&]page=/);
	});

	test('clearing filters resets the URL back to the base logs route', async ({ page }) => {
		await page
			.getByPlaceholder(/such|search/i)
			.first()
			.fill('temp');
		await page
			.getByRole('button', { name: /apply|anwenden|filter/i })
			.first()
			.click();
		await expect(page).toHaveURL(/[?&]search=temp/);

		await page
			.getByRole('button', { name: /clear|zurücksetzen|löschen/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/admin\/logs$/);
	});
});

test.describe('Post-compaction page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'post-compaction');
		await page.waitForLoadState('networkidle');
	});

	test('renders the page heading and address search field', async ({ page }) => {
		await expect(
			page.getByRole('heading', { name: /post-compaction|nachverdichtung/i })
		).toBeVisible();
		await expect(page.getByPlaceholder(/address|adresse/i).first()).toBeVisible();
	});

	test('the address search field accepts input', async ({ page }) => {
		const search = page.getByPlaceholder(/address|adresse/i).first();
		await search.fill('Hauptstraße');
		await expect(search).toHaveValue('Hauptstraße');
	});

	test('a URL naming an address opens its workspace; reload keeps it, clearing returns to the search', async ({
		page
	}) => {
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));
		const address = await firstFeature(page, 'address', id);
		test.skip(!address, 'Needs at least one address in the project');
		const uuid = /** @type {import('./helpers/api.js').ListedFeature} */ (address).uuid;

		await page.goto(projectPath(id, 'post-compaction', { address: uuid }));

		const clear = page.getByRole('button', { name: /clear selection|auswahl/i });
		await expect(clear).toBeVisible({ timeout: 15000 });
		await expect(page.getByPlaceholder(/address|adresse/i)).toHaveCount(0);

		await page.reload();
		await expect(page.getByRole('button', { name: /clear selection|auswahl/i })).toBeVisible({
			timeout: 15000
		});

		// Clearing rewrites the entry: the search is back and the URL carries no address.
		await page.getByRole('button', { name: /clear selection|auswahl/i }).click();
		await expect(page).not.toHaveURL(/address=/);
		await expect(page.getByPlaceholder(/address|adresse/i).first()).toBeVisible();
	});
});

test.describe('Pipe-branch page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'pipe-branch');
		await page.waitForLoadState('networkidle');
	});

	test('picking a branch names it in the URL; reload keeps it and back returns', async ({
		page
	}) => {
		const picker = page.getByPlaceholder(/select pipe branch|rohrverzweigung auswählen/i).first();
		await picker.click();
		const option = page.getByRole('option').first();
		test.skip((await option.count()) === 0, 'Needs at least one pipe branch in the project');

		await option.click();

		await expect(page).toHaveURL(/\/pipe-branch\/node\/[0-9a-f-]{36}$/);
		await expect(page.locator('[data-testid="svelte-flow__wrapper"]').first()).toBeVisible({
			timeout: 15000
		});

		await page.reload();
		await expect(page).toHaveURL(/\/pipe-branch\/node\//);
		await expect(page.locator('[data-testid="svelte-flow__wrapper"]').first()).toBeVisible({
			timeout: 15000
		});

		await page.goBack();
		await expect(page).toHaveURL(/\/pipe-branch$/);
	});

	test('renders the SvelteFlow canvas and the branch selector', async ({ page }) => {
		await expect(page.locator('[data-testid="svelte-flow__wrapper"]').first()).toBeVisible({
			timeout: 15000
		});
		// The attributes panel exposes the pipe-branch picker as a combobox input.
		await expect(
			page.getByPlaceholder(/select pipe branch|rohrverzweigung auswählen/i).first()
		).toBeVisible();
	});
});

test.describe('Valuation page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'valuation');
		await page.waitForLoadState('networkidle');
	});

	test('renders the area selection and valuation sections with a map', async ({ page }) => {
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
		await expect(
			page.getByRole('heading', { name: /select area|gebiet auswählen/i })
		).toBeVisible();
		// The whole-project valuation runs from the URL, so its projection heading
		// appears in the results as well as in the inputs.
		await expect(
			page.getByRole('heading', { name: /valuation|wertermittlung/i }).first()
		).toBeVisible();
	});

	test('the selection and inputs live in the URL and survive a reload', async ({ page }) => {
		const areaBoxes = page.locator('.max-h-60 input[type="checkbox"]');
		await expect(
			page.getByRole('heading', { name: /select area|gebiet auswählen/i })
		).toBeVisible();
		await page.waitForLoadState('networkidle');
		test.skip((await areaBoxes.count()) < 2, 'Needs at least two areas in the project');

		await areaBoxes.nth(0).check();
		await expect(page).toHaveURL(/[?&]areas=[0-9a-f-]{36}/);
		await areaBoxes.nth(1).check();
		await expect(page).toHaveURL(/[?&]areas=[0-9a-f-]{36}%2C[0-9a-f-]{36}/);

		const baseYear = page.getByLabel(/completion year|bauabschluss/i);
		await baseYear.fill('2030');
		await baseYear.press('Tab');
		await expect(page).toHaveURL(/[?&]baseYear=2030/);

		// The valuation of the selection replaces the whole-project one; read
		// the total once it has stopped changing.
		const total = page.locator('tfoot').first();
		await expect(total).toBeVisible({ timeout: 20000 });
		/** @type {string} */
		/** @param {import('@playwright/test').Locator} cell */
		const textOf = async (cell) => (await cell.innerText()).replace(/\s+/g, ' ').trim();
		let totalText = '';
		await expect
			.poll(
				async () => {
					const before = await textOf(total);
					await page.waitForTimeout(1500);
					totalText = await textOf(total);
					return totalText === before;
				},
				{ timeout: 30000 }
			)
			.toBe(true);

		await page.reload();

		await expect(page.locator('.max-h-60 input[type="checkbox"]:checked')).toHaveCount(2, {
			timeout: 15000
		});
		await expect(page.getByLabel(/completion year|bauabschluss/i)).toHaveValue('2030');
		await expect
			.poll(() => textOf(page.locator('tfoot').first()), { timeout: 20000 })
			.toBe(totalText);
	});

	test('the whole-project checkbox follows repeated toggles', async ({ page }) => {
		const wholeProject = page.getByRole('checkbox', {
			name: /total \(whole project\)|gesamt \(ganzes projekt\)/i
		});
		const results = page.locator('tfoot').first();
		await expect(wholeProject).toBeChecked();
		await expect(results).toBeVisible({ timeout: 20000 });

		await wholeProject.click();
		await expect(wholeProject).not.toBeChecked();
		await expect(results).toBeHidden();

		await wholeProject.click();
		await expect(results).toBeVisible({ timeout: 20000 });
		await expect(wholeProject).toBeChecked();

		await wholeProject.click();
		await expect(results).toBeHidden();
		await expect(wholeProject).not.toBeChecked();
	});

	test('an area checkbox follows repeated toggles', async ({ page }) => {
		const areaBox = page.locator('.max-h-60 input[type="checkbox"]').first();
		await expect(
			page.getByRole('heading', { name: /select area|gebiet auswählen/i })
		).toBeVisible();
		await page.waitForLoadState('networkidle');
		test.skip((await areaBox.count()) === 0, 'Needs at least one area in the project');
		const wholeProject = page.getByRole('checkbox', {
			name: /total \(whole project\)|gesamt \(ganzes projekt\)/i
		});

		// Start from picking areas, the state the first area click leaves.
		await wholeProject.click();
		await expect(wholeProject).not.toBeChecked();

		await areaBox.click();
		await expect(page).toHaveURL(/[?&]areas=[0-9a-f-]{36}/);
		await expect(areaBox).toBeChecked();
		await expect(wholeProject).not.toBeChecked();

		await areaBox.click();
		await expect(page).not.toHaveURL(/[?&]areas=/);
		await expect(areaBox).not.toBeChecked();
		await expect(wholeProject).toBeChecked();

		await areaBox.click();
		await expect(page).toHaveURL(/[?&]areas=[0-9a-f-]{36}/);
		await expect(areaBox).toBeChecked();

		await areaBox.click();
		await expect(page).not.toHaveURL(/[?&]areas=/);
		await expect(areaBox).not.toBeChecked();

		await areaBox.click();
		await expect(page).toHaveURL(/[?&]areas=[0-9a-f-]{36}/);
		await expect(areaBox).toBeChecked();
	});

	test('exposes the area search input', async ({ page }) => {
		await expect(page.locator('[data-testid="search-input"]').first()).toBeVisible({
			timeout: 15000
		});
	});
});

test.describe('House connections page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'house-connections');
		await page.waitForLoadState('networkidle');
	});

	test('renders the map canvas and the search input', async ({ page }) => {
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
		await expect(page.locator('[data-testid="search-input"]').first()).toBeVisible();
	});

	test('a URL naming a trench opens its drawer with the trench title', async ({ page }) => {
		const id = /** @type {string} */ (projectIdFromUrl(page.url()));
		const trench = await firstFeature(page, 'trench', id);
		test.skip(!trench, 'Needs at least one trench in the project');
		const { uuid, label } = /** @type {import('./helpers/api.js').ListedFeature} */ (trench);

		await page.goto(projectPath(id, 'house-connections', { feature: `trench:${uuid}` }));

		const drawer = page.locator('[data-drawer]');
		await expect(drawer).toBeVisible({ timeout: 15000 });
		await expect(drawer.locator('h2')).toHaveText(label);
	});
});
