import { expect, test } from '@playwright/test';

import { loginOrSkip, submitLoginForm } from './helpers/auth.js';
import { getProjectId, gotoProjectRoute, projectIdFromUrl, projectPath } from './helpers/routes.js';

/**
 * The contract of the URL-first epic: the URL alone says where you are, no
 * server redirect fills in a project, and legacy shapes are gone.
 */

/**
 * A visible project option other than the one currently shown in the picker.
 * @param {import('@playwright/test').Page} page
 */
async function otherProjectOption(page) {
	const input = page.locator('[data-scope="combobox"][data-part="input"]').first();
	const current = (await input.inputValue()).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const options = page.locator('[data-scope="combobox"][data-part="item"]:visible');
	return options.filter({ hasNotText: new RegExp(`^\\s*${current}\\s*$`) }).first();
}

/** @param {import('@playwright/test').Page} page */
function errorHeading(page) {
	return page.getByRole('heading', { name: '404' });
}

test.describe('Routing contract', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
	});

	test('the root URL lands on the map of a project', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveURL(/\/project\/\d+\/map$/);
	});

	test('a sidebar click lands on the project route without any redirect', async ({ page }) => {
		const id = await gotoProjectRoute(page, 'dashboard');
		/** @type {number[]} */
		const redirects = [];
		page.on('response', (response) => {
			if (
				response.request().resourceType() === 'document' &&
				response.status() >= 300 &&
				response.status() < 400
			) {
				redirects.push(response.status());
			}
		});

		await page
			.locator(`a[href="${projectPath(id, 'map')}"]`)
			.first()
			.click();

		await expect(page).toHaveURL(new RegExp(`${projectPath(id, 'map')}$`));
		expect(redirects).toEqual([]);
	});

	test('legacy route shapes are 404s, not redirects', async ({ page }) => {
		const id = await getProjectId(page);

		await page.goto('/map');
		await expect(errorHeading(page)).toBeVisible();
		await expect(page).toHaveURL(/\/map$/);

		await page.goto(`/map/${id}`);
		await expect(errorHeading(page)).toBeVisible();
	});

	test('an unknown or malformed project id is a 404', async ({ page }) => {
		await page.goto('/project/999999/map');
		await expect(errorHeading(page)).toBeVisible();

		await page.goto('/project/abc/map');
		await expect(errorHeading(page)).toBeVisible();
	});

	test('a project URL without a sub-route lands on its map', async ({ page }) => {
		const id = await getProjectId(page);

		await page.goto(projectPath(id));

		await expect(page).toHaveURL(new RegExp(`${projectPath(id, 'map')}$`));
	});

	test('switching the project keeps the route and back returns to the previous project', async ({
		page
	}) => {
		const id = await gotoProjectRoute(page, 'address');
		const trigger = page.locator('[data-scope="combobox"][data-part="trigger"]').first();
		const options = page.locator('[data-scope="combobox"][data-part="item"]:visible');

		await trigger.click();
		test.skip((await options.count()) < 2, 'Needs at least two active projects');
		await (await otherProjectOption(page)).click();

		await page.waitForURL((url) => projectIdFromUrl(url.href) !== id);
		await expect(page).toHaveURL(/\/project\/\d+\/address$/);
		const otherId = projectIdFromUrl(page.url());
		expect(otherId).not.toBe(id);

		await page.goBack();
		await expect(page).toHaveURL(new RegExp(`${projectPath(id, 'address')}$`));
	});

	test('the root URL remembers the project visited last', async ({ page }) => {
		const id = await getProjectId(page);
		await gotoProjectRoute(page, 'address');
		const trigger = page.locator('[data-scope="combobox"][data-part="trigger"]').first();
		const options = page.locator('[data-scope="combobox"][data-part="item"]:visible');
		await trigger.click();
		test.skip((await options.count()) < 2, 'Needs at least two active projects');
		await (await otherProjectOption(page)).click();
		await page.waitForURL((url) => projectIdFromUrl(url.href) !== id);
		const otherId = projectIdFromUrl(page.url());
		// The project layout remembers the project right after the navigation settles.
		await expect
			.poll(
				async () => (await page.context().cookies()).find((c) => c.name === 'last-project')?.value
			)
			.toBe(otherId);

		await page.goto('/');

		await expect(page).toHaveURL(new RegExp(`${projectPath(String(otherId), 'map')}$`));
	});
});

test.describe('Deep links through login', () => {
	test('a logged-out deep link comes back to exactly that URL after login', async ({ page }) => {
		await loginOrSkip(page, test.skip);
		const id = await getProjectId(page);
		await page.context().clearCookies();

		await page.goto(projectPath(id, 'conduit', { search: 'x' }));
		await expect(page).toHaveURL(/\/login\?redirectTo=/);

		expect(await submitLoginForm(page)).toBe(true);

		await expect(page).toHaveURL(new RegExp(`${projectPath(id, 'conduit')}\\?search=x$`));
	});
});
