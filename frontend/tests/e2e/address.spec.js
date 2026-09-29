import { expect, test } from '@playwright/test';

import { firstFeature } from './helpers/api.js';
import { API_URL, loginOrSkip } from './helpers/auth.js';
import { getProjectId, gotoProjectRoute, projectPath } from './helpers/routes.js';

/**
 * Desktop address rows (the md:block table body).
 * @param {import('@playwright/test').Page} page
 */
function desktopRows(page) {
	return page.locator('.hidden.md\\:block table tbody tr');
}

test.describe('Address list page', () => {
	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		await gotoProjectRoute(page, 'address');
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
		await expect(page).not.toHaveURL(/[?&]page=/);
	});

	/**
	 * Street is the second column, so its cell is the 2nd `td` in each row.
	 * Scoping to each row avoids Playwright flattening all cells into one list.
	 * @param {import('@playwright/test').Page} page
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
					cells.every((/** @type {string} */ c) =>
						c.toLowerCase().includes(/** @type {string} */ (firstStreet).toLowerCase())
					)
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
		await page.waitForURL(/\/project\/\d+\/address\/[0-9a-f-]{36}$/, { timeout: 10000 });
	});

	test('mobile viewport shows the card list with a search box', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });

		// The mobile layout swaps the table for cards and its own search field.
		await expect(page.locator('input[name="mobile-search"]')).toBeVisible();
	});
});

/**
 * The product of `opacity` over an element and its ancestors: what a user
 * actually sees. Playwright counts `opacity: 0` as visible, so a hidden-by-
 * opacity button would pass `toBeVisible` on its own.
 * @param {import('@playwright/test').Locator} locator
 * @returns {Promise<number>}
 */
function effectiveOpacity(locator) {
	return locator.evaluate((el) => {
		let opacity = 1;
		for (let node = /** @type {Element | null} */ (el); node; node = node.parentElement) {
			opacity *= Number(getComputedStyle(node).opacity);
		}
		return opacity;
	});
}

/**
 * Attachments on the address detail page: a long-named file is uploaded
 * through the real form, then deleted through the file explorer's actions.
 */
test.describe('Address detail attachments', () => {
	// Unique per worker: parallel workers upload to the same address, and a
	// shared name would let one worker's delete remove another worker's file.
	const stem = `e2e-attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-with-a-deliberately-long-name-that-has-to-truncate`;
	const fileName = `${stem}.txt`;
	/** @type {string | null} */
	let addressUuid = null;

	test.beforeEach(async ({ page }) => {
		await loginOrSkip(page, test.skip);
		const projectId = await getProjectId(page);
		const address = await firstFeature(page, 'address', projectId);
		test.skip(!address, 'Needs at least one address in the project');
		addressUuid = /** @type {import('./helpers/api.js').ListedFeature} */ (address).uuid;

		await page.goto(projectPath(projectId, `address/${addressUuid}`));
		// The cards above load asynchronously and shift the attachments card down.
		await page.waitForLoadState('networkidle');
		const card = attachmentsCard(page);
		await card.locator('input[type="file"]').setInputFiles({
			name: fileName,
			mimeType: 'text/plain',
			buffer: Buffer.from('e2e attachment')
		});
		const uploaded = page.waitForResponse(
			(r) => r.request().method() === 'POST' && r.url().endsWith('/feature-files/')
		);
		await card.getByRole('button', { name: /^(upload 1 file|1 datei hochladen)$/i }).click();
		const response = await uploaded;
		expect(response.ok(), `upload: ${response.status()} ${await response.text()}`).toBe(true);

		const row = fileRow(page);
		const branch = card
			.locator('[data-scope="tree-view"][data-part="branch"]')
			.filter({ hasText: stem });
		await expect(branch).toHaveCount(1, { timeout: 15000 });
		if (!(await row.isVisible())) await branch.locator('[data-part="branch-control"]').click();
		await expect(row).toBeVisible();
	});

	test.afterEach(async ({ page }) => {
		if (!addressUuid) return;
		const response = await page.request.get(
			`${API_URL}feature-files/?object_id=${addressUuid}&page_size=100`
		);
		if (!response.ok()) return;
		const payload = await response.json();
		const files = Array.isArray(payload) ? payload : (payload.results ?? []);
		for (const file of files) {
			if (String(file.file_name).startsWith(stem)) {
				await page.request.delete(`${API_URL}feature-files/${file.uuid}/`);
			}
		}
	});

	/**
	 * @param {import('@playwright/test').Page} page
	 */
	function attachmentsCard(page) {
		return page
			.locator('.card')
			.filter({ has: page.getByRole('heading', { name: /^(attachments|anhänge)$/i }) });
	}

	/**
	 * @param {import('@playwright/test').Page} page
	 */
	function fileRow(page) {
		return attachmentsCard(page)
			.locator('[data-scope="tree-view"][data-part="item"]')
			.filter({ hasText: stem });
	}

	/**
	 * Confirms the open delete dialog and waits for the row to disappear.
	 * @param {import('@playwright/test').Page} page
	 */
	async function confirmDeletion(page) {
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: /^(delete|löschen)$/i }).click();
		await expect(fileRow(page)).toHaveCount(0);
	}

	test('a long file name stays inside the card and its delete action is clickable', async ({
		page
	}) => {
		const row = fileRow(page);
		const cardBox = await attachmentsCard(page).boundingBox();
		const rowBox = await row.boundingBox();
		if (!cardBox || !rowBox) throw new Error('Attachments card or file row is not rendered');
		expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);

		await row.hover();
		const remove = row.getByRole('button', { name: /^(delete file|datei löschen)$/i });
		await expect.poll(() => effectiveOpacity(remove)).toBe(1);
		// A neighbouring column painted over the button would intercept this click.
		await remove.click();
		await confirmDeletion(page);
	});

	test.describe('on a touch device', () => {
		test.skip(({ browserName }) => browserName !== 'chromium', 'Touch emulation needs Chromium');
		test.use({ viewport: { width: 800, height: 1000 }, hasTouch: true, isMobile: true });

		test('tapping a file reveals actions that delete it', async ({ page }) => {
			expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

			const row = fileRow(page);
			await row.getByText(stem).tap();

			const remove = row
				.getByRole('button', { name: /^(delete file|datei löschen)$/i })
				.filter({ visible: true });
			await expect(remove).toHaveCount(1);
			await expect.poll(() => effectiveOpacity(remove)).toBe(1);
			await remove.tap();
			await confirmDeletion(page);
		});
	});
});
