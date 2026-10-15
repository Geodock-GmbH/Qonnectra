import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

import { loginOrSkip } from '../e2e/helpers/auth.js';
import { gotoProjectRoute, projectIdFromUrl } from '../e2e/helpers/routes.js';

const OUTPUT = path.resolve(import.meta.dirname, '../../../loadtest/calibration.json');

/**
 * Maps a request URL to the endpoint name the load-test personas use, so
 * browser and load test counts line up. Feature tiles without a project
 * filter are the global view's (`tile:global:<layer>`); `page-data` is a
 * client navigation that had to rerun a server load.
 * @param {string} url - Request URL.
 * @returns {string | null} Endpoint name such as `tile:trench`, or null for static assets.
 */
function endpointName(url) {
	const { pathname, searchParams } = new URL(url);
	const tile = pathname.match(/\/ol_(\w+)_tiles\//);
	if (tile) return searchParams.has('project') ? `tile:${tile[1]}` : `tile:global:${tile[1]}`;
	if (pathname.includes('/wms-proxy/')) return 'tile:wms';
	if (/\/data\/[^/]+\/\d+\/\d+\/\d+\.pbf$/.test(pathname)) return 'tile:basemap';
	if (pathname.endsWith('/health') && !pathname.includes('/api/')) return 'basemap:health';
	if (/\/styles\/[^/]+\/style\.json$/.test(pathname)) return 'basemap:style';
	if (/\/data\/[^/]+\.json$/.test(pathname)) return 'basemap:tilejson';
	const remote = pathname.match(/\/_app\/remote\/[^/]+\/(\w+)/);
	if (remote) return `remote:${remote[1]}`;
	if (pathname.endsWith('/__data.json')) return 'page-data';
	const api = pathname.match(/\/api\/v1\/(.+)$/);
	if (api) {
		return `api:${api[1].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':uuid').replace(/\/\d+(?=\/|$)/g, '/:id')}`;
	}
	if (pathname.startsWith('/_app/') || /\.\w{2,5}$/.test(pathname)) return null;
	return `page:${pathname.replace(/\/\d+(?=\/|$)/g, '/:id')}`;
}

/**
 * Drags the map by an offset, like a user panning with the mouse.
 * @param {import('@playwright/test').Page} page - Page showing the map.
 * @param {{ x: number, y: number, width: number, height: number }} box - Map viewport box.
 * @param {number} dx - Horizontal drag distance in pixels.
 * @param {number} dy - Vertical drag distance in pixels.
 */
async function pan(page, box, dx, dy) {
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
	await page.mouse.up();
}

/**
 * Waits until the map has finished loading what the last gesture asked for.
 * @param {import('@playwright/test').Page} page - Page showing the map.
 */
async function settle(page) {
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(500);
}

/**
 * Clicks the app bar's global view toggle.
 * @param {import('@playwright/test').Page} page - Page showing the map.
 * @param {boolean} on - Whether the click switches the global view on.
 */
async function toggleGlobalView(page, on) {
	const name = on
		? /view all projects|alle projekte anzeigen/i
		: /view current project only|nur aktuelles projekt anzeigen/i;
	await page.getByRole('button', { name }).click();
	await settle(page);
}

/**
 * Picks a project in the app bar's project switcher, a client-side navigation
 * to the same page of that project.
 * @param {import('@playwright/test').Page} page - Page showing the map.
 * @param {string | null} id - Project to switch to, or null for any other one.
 * @returns {Promise<boolean>} Whether the switch happened; false when there is no other project to pick.
 */
async function switchProject(page, id) {
	const before = page.url();
	await page.getByRole('combobox').first().click();
	const option = id
		? page.locator(`[role="option"][data-value="${id}"]`)
		: page.getByRole('option', { selected: false }).first();
	if ((await option.count()) === 0) {
		await page.keyboard.press('Escape');
		return false;
	}
	await option.click();
	await page.waitForURL((url) => url.href !== before);
	await settle(page);
	return true;
}

test('record a realistic map session for load-test calibration', async ({ page }) => {
	await loginOrSkip(page, test.skip);

	let phase = 'login';
	/** @type {Record<string, Record<string, number>>} */
	const counts = {};
	/** @type {Record<string, { total: number, unique: Set<string> }>} */
	const tiles = {};

	page.on('request', (request) => {
		const url = request.url();
		const name = endpointName(url);
		if (!name || phase === 'restore') return;
		counts[phase] ??= {};
		counts[phase][name] = (counts[phase][name] ?? 0) + 1;

		if (name.startsWith('tile:') && phase === 'open') {
			tiles[name] ??= { total: 0, unique: new Set() };
			tiles[name].total += 1;
			tiles[name].unique.add(url);
		}
	});

	phase = 'open';
	await gotoProjectRoute(page, 'map');
	const viewport = page.locator('.ol-viewport').first();
	await expect(viewport).toBeVisible({ timeout: 15000 });
	await settle(page);
	const box = await viewport.boundingBox();
	if (!box) throw new Error('Map viewport has no size');

	phase = 'pan';
	for (const [dx, dy] of [
		[400, 0],
		[0, 250],
		[-400, 0],
		[0, -250],
		[300, 200]
	]) {
		await pan(page, box, dx, dy);
		await settle(page);
	}

	phase = 'zoom';
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	for (const delta of [-300, -300, 300]) {
		await page.mouse.wheel(0, delta);
		await settle(page);
	}

	phase = 'click';
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await settle(page);

	phase = 'search';
	await page
		.getByPlaceholder(/suchen|search/i)
		.first()
		.pressSequentially('Lastweg', { delay: 120 });
	await page.waitForTimeout(1500);
	await settle(page);

	// The global view is a saved setting, so it is switched off again; the
	// restore phase is not part of any session.
	phase = 'global';
	await toggleGlobalView(page, true);
	await pan(page, box, 400, 0);
	await settle(page);
	phase = 'restore';
	await toggleGlobalView(page, false);

	phase = 'switch';
	const startProject = projectIdFromUrl(page.url());
	const switched = await switchProject(page, null);
	phase = 'restore';
	if (switched) await switchProject(page, startProject);

	phase = 'network-schema';
	await gotoProjectRoute(page, 'network-schema');
	await settle(page);

	const tileFactors = Object.fromEntries(
		Object.entries(tiles).map(([name, { total, unique }]) => [
			name,
			{ total, unique: unique.size, factor: Number((total / unique.size).toFixed(2)) }
		])
	);
	const result = {
		recordedAt: new Date().toISOString(),
		baseURL: page.url().replace(/\/project\/.*/, ''),
		tileFactors,
		counts
	};
	writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
	console.log(`Calibration written to ${OUTPUT}`);
	console.table(tileFactors);
	for (const [name, perEndpoint] of Object.entries(counts)) {
		console.log(`\n${name}`);
		console.table(perEndpoint);
	}

	const featureTiles = Object.keys(tileFactors).filter((name) =>
		/^tile:(?!wms|basemap)/.test(name)
	);
	expect(featureTiles, 'the map loaded no feature tiles at all').not.toEqual([]);
});
