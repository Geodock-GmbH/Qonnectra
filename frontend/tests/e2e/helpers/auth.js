import path from 'path';
import { expect } from '@playwright/test';
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
 * Whether the backend answers at all. Only an unreachable backend justifies
 * skipping; every other login problem is a real failure.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function backendReachable(page) {
	try {
		await page.request.get(API_URL, { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Logs in through the real login form and waits until the app has left /login.
 * Returns whether login succeeded so callers can decide between skip and fail.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function performLogin(page) {
	if (!hasTestCredentials) return false;

	// A second attempt covers a login that timed out while parallel workers
	// were saturating the dev servers; a broken login fails both attempts.
	for (let attempt = 0; attempt < 2; attempt++) {
		await page.goto('/login');
		if (await submitLoginForm(page)) return true;
	}
	return false;
}

/**
 * Fills and submits the login form already on screen (keeps any `redirectTo`
 * the page was opened with) and waits until the app has left /login.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function submitLoginForm(page) {
	if (!hasTestCredentials) return false;

	// Typing before hydration is lost when the remote form takes over its
	// fields, and the empty required fields then block the submit silently.
	await page.waitForLoadState('networkidle');
	await page.locator('input[name="username"]').fill(/** @type {string} */ (TEST_USERNAME));
	await page.locator('input[name="_password"]').fill(/** @type {string} */ (TEST_PASSWORD));
	await page.locator('button[type="submit"]').click();

	try {
		await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Shared beforeEach body: skips when credentials are missing or the backend
 * is unreachable, and **fails** when the login form is reachable but login
 * does not succeed (stale selector, bad credentials): a suite that silently
 * skips everything hides a broken app.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestType<any, any>['skip']} skip
 */
export async function loginOrSkip(page, skip) {
	skip(!hasTestCredentials, 'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');
	skip(!(await backendReachable(page)), `Backend at ${API_URL} is unreachable`);
	const loggedIn = await performLogin(page);
	expect(loggedIn, 'Login through the real form must succeed').toBe(true);
}
