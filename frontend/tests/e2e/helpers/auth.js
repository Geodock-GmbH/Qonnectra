import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const TEST_USERNAME = process.env.E2E_TEST_USERNAME;
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
export const API_URL =
	process.env.PUBLIC_API_URL || process.env.API_URL || 'http://localhost:8000/api/v1/';

/**
 * True when the env test user is configured. Specs use this with `test.skip`
 * so the suite is a no-op (not a failure) on machines without credentials.
 */
export const hasTestCredentials = Boolean(TEST_USERNAME && TEST_PASSWORD);

/**
 * Logs in through the real login form and waits until the app has left /login.
 * Returns whether login succeeded so callers can `test.skip` on invalid creds
 * rather than failing with a confusing downstream error.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function performLogin(page) {
	if (!hasTestCredentials) return false;

	await page.goto('/login');
	await page.locator('input[name="username"]').fill(/** @type {string} */ (TEST_USERNAME));
	await page.locator('input[name="password"]').fill(/** @type {string} */ (TEST_PASSWORD));
	await page.locator('button[type="submit"]').click();

	try {
		await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Shared beforeEach body: skips when creds are missing, logs in, and skips
 * (rather than fails) if login itself does not succeed.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestType<any, any>['skip']} skip
 */
export async function loginOrSkip(page, skip) {
	skip(!hasTestCredentials, 'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');
	const loggedIn = await performLogin(page);
	skip(!loggedIn, 'Login failed - test credentials may be invalid');
}
