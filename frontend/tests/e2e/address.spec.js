import { expect, test } from '@playwright/test';

import { loginOrSkip } from './helpers/auth.js';

/** Desktop address rows (the md:block table body). */
function desktopRows(page) {
	return page.locator('.hidden.md\\:block table tbody tr');
}

test.describe('Address list page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		// Bare /address redirects to /address/<active project id>.
		await page.goto('/address');
		await page.waitForURL(/\/address\/[^/]+$/, { timeout: 10000 });
		await page.waitForLoadState('networkidle');
	});

	test('renders the address table with column headers', async ({ page }) => {
		const header = page.locator('.hidden.md\\:block table thead');
		await expect(header.getByText(/street|straße/i).first()).toBeVisible();
		await expect(header.getByText(/zip code|plz|postleitzahl/i).first()).toBeVisible();
		await expect(header.getByText(/city|stadt|ort/i).first()).toBeVisible();
	});

	test('shows the total results count from the backend', async ({ page }) => {
		// The pagination bar reports the real total row count.
		await expect(page.getByText(/results|ergebnisse|treffer/i).first()).toBeVisible();
	});

	test('searching updates the URL search parameter', async ({ page }) => {
		const search = page.getByPlaceholder(/search|suche/i).first();
		await search.fill('teststreet-xyz');
		await search.press('Enter');

		await expect(page).toHaveURL(/[?&]search=teststreet-xyz/);
		await expect(page).toHaveURL(/[?&]page=1/);
	});

	/**
	 * Street is the second column, so its cell is the 2nd `td` in each row.
	 * Scoping to each row avoids Playwright flattening all cells into one list.
	 */
	function streetCells(page) {
		return desktopRows(page).locator('td[data-label]:nth-child(2)');
	}

	test('a per-column filter narrows the rows to matching streets', async ({ page }) => {
		const rowsBefore = await desktopRows(page).count();
		test.skip(rowsBefore < 1, 'No address rows available to filter');

		const firstStreet = (await streetCells(page).first().textContent())?.trim();
		test.skip(!firstStreet, 'First row has no street value to filter by');

		await page.locator('input[name="filter-street"]').fill(/** @type {string} */ (firstStreet));

		// Every surviving row's street cell must contain the filter term.
		await expect
			.poll(async () => {
				const cells = await streetCells(page).allTextContents();
				return (
					cells.length > 0 &&
					cells.every((c) => c.toLowerCase().includes(firstStreet.toLowerCase()))
				);
			})
			.toBe(true);
	});

	test('a filter with no matches shows the empty state', async ({ page }) => {
		test.skip((await desktopRows(page).count()) < 1, 'No address rows to filter');

		await page.locator('input[name="filter-street"]').fill('zzz-no-such-street-zzz');

		// Non-matching filter collapses to the single "no results" row.
		await expect(page.getByText(/no results|keine ergebnisse/i).first()).toBeVisible();
	});

	test('clicking a row navigates to the address detail page', async ({ page }) => {
		const rowCount = await desktopRows(page).count();
		test.skip(rowCount < 1, 'No address rows available to open');

		await desktopRows(page).first().click();
		// Detail route is /address/<projectId>/<uuid>.
		await page.waitForURL(/\/address\/[^/]+\/[0-9a-f-]{36}/, { timeout: 10000 });
	});

	test('mobile viewport shows the card list with a search box', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });

		// The mobile layout swaps the table for cards and its own search field.
		await expect(page.locator('input[name="mobile-search"]')).toBeVisible();
	});
});
