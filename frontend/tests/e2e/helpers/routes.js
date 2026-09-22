import { expect } from '@playwright/test';

/** Path of a project-scoped page, capturing the project id. */
const PROJECT_PATH = /^\/project\/(?<id>\d+)(?:\/|$)/;

/** @type {string | null} */
let cachedProjectId = process.env.E2E_PROJECT_ID || null;

/**
 * Reads the project id from a project-scoped URL.
 * @param {string} url - An absolute URL or a path.
 * @returns {string | null} The id, or null on a global page.
 */
export function projectIdFromUrl(url) {
	const pathname = new URL(url, 'http://localhost').pathname;
	return pathname.match(PROJECT_PATH)?.groups?.id ?? null;
}

/**
 * The project the tests run against, resolved once per worker: `E2E_PROJECT_ID`
 * when set, else the project the app lands on after login.
 * @param {import('@playwright/test').Page} page - A logged-in page.
 * @returns {Promise<string>} The project id.
 */
export async function getProjectId(page) {
	if (cachedProjectId) return cachedProjectId;
	await page.goto('/');
	await page.waitForURL(PROJECT_PATH_URL, { timeout: 15000 });
	const id = projectIdFromUrl(page.url());
	if (!id) throw new Error(`Landing URL ${page.url()} names no project`);
	cachedProjectId = id;
	return id;
}

/** Matches the landing URL of any project. */
const PROJECT_PATH_URL = /\/project\/\d+\//;

/**
 * Builds the path of a project-scoped page.
 * @param {string} id - The project id.
 * @param {string} [route] - The page under the project, e.g. `map` or `address/abc`.
 * @param {Record<string, string>} [query] - Query parameters to append.
 * @returns {string} The path.
 */
export function projectPath(id, route = '', query) {
	const suffix = route ? `/${route.replace(/^\//, '')}` : '';
	const search = query ? `?${new URLSearchParams(query)}` : '';
	return `/project/${id}${suffix}${search}`;
}

/**
 * Opens a project-scoped page and asserts the app stayed on exactly that URL:
 * a redirect is a failure, not something to tolerate.
 * @param {import('@playwright/test').Page} page - A logged-in page.
 * @param {string} route - The page under the project, e.g. `map`.
 * @param {Record<string, string>} [query] - Query parameters to append.
 * @returns {Promise<string>} The project id used.
 */
export async function gotoProjectRoute(page, route, query) {
	const id = await getProjectId(page);
	const path = projectPath(id, route, query);
	await page.goto(path);
	const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	await expect(page).toHaveURL(new RegExp(`^https?://[^/]+${escaped}(?:#.*)?$`));
	return id;
}
