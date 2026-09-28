/**
 * Reloads the page the way a user does, from inside the page. Use it instead
 * of `page.reload()` when the test steps through history afterwards:
 * Playwright's Firefox adds a history entry on `page.reload()`, so a
 * following `goBack()` lands on the same URL again. `location.reload()`
 * keeps the history intact in every browser.
 * @param {import('@playwright/test').Page} page
 */
export async function reloadPage(page) {
	await Promise.all([
		page.waitForEvent('load'),
		page.evaluate(() => void setTimeout(() => location.reload()))
	]);
}
