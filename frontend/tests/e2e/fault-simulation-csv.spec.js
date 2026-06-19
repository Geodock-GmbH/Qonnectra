import path from 'path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const USERNAME = process.env.E2E_TEST_USERNAME;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!USERNAME || !PASSWORD, 'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function performLogin(page) {
	await page.goto('/login');
	await page.locator('input[name="username"]').fill(/** @type {string} */ (USERNAME));
	await page.locator('input[name="password"]').fill(/** @type {string} */ (PASSWORD));
	await page.locator('button[type="submit"]').click();

	try {
		await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * @returns {Record<string, any>}
 */
function createMockSimulationResult() {
	return {
		trench: {
			id_trench: 'TR-001-E2E',
			construction_type: 'Open Cut',
			uuid: 'trench-uuid-001'
		},
		summary: {
			total_cables_affected: 2,
			affected_addresses: 2,
			affected_residential_units: 3
		},
		conduits: [
			{ uuid: 'conduit-uuid-1', name: 'Conduit A', conduit_type: 'Standard' },
			{ uuid: 'conduit-uuid-2', name: 'Conduit B', conduit_type: 'Micro' }
		],
		cables: [
			{
				uuid: 'cable-uuid-1',
				name: 'Cable 1',
				cable_type: 'Fiber',
				fiber_count: 96,
				dark_fibers: 12,
				node_start: { name: 'Node A' },
				node_end: { name: 'Node B' }
			},
			{
				uuid: 'cable-uuid-2',
				name: 'Cable 2',
				cable_type: 'Copper',
				fiber_count: 48,
				dark_fibers: 0,
				node_start: { name: 'Node C' },
				node_end: { name: 'Node D' }
			}
		],
		affected_addresses_details: [
			{
				uuid: 'addr-uuid-1',
				id_address: 'ADDR-001',
				street: 'Hauptstraße',
				housenumber: '12',
				zip_code: '12345',
				city: 'Berlin',
				residential_units: [
					{
						uuid: 'ru-uuid-1',
						id_residential_unit: 'RU-001',
						floor: '1',
						side: 'Left',
						type: 'FTTH',
						status: 'Active'
					},
					{
						uuid: 'ru-uuid-2',
						id_residential_unit: 'RU-002',
						floor: '2',
						side: 'Right',
						type: 'FTTH',
						status: 'Active'
					}
				]
			},
			{
				uuid: 'addr-uuid-2',
				id_address: 'ADDR-002',
				street: 'Berliner Str.',
				housenumber: '5',
				zip_code: '54321',
				city: 'Hamburg',
				residential_units: [
					{
						uuid: 'ru-uuid-3',
						id_residential_unit: 'RU-003',
						floor: '3',
						side: 'Center',
						type: 'FTTB',
						status: 'Planned'
					}
				]
			}
		],
		geometry: {
			affected_trenches: { type: 'FeatureCollection', features: [] },
			affected_nodes: { type: 'FeatureCollection', features: [] },
			affected_addresses: { type: 'FeatureCollection', features: [] }
		}
	};
}

/**
 * Injects a mock simulation result into the Svelte context via the dev-only test hook.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, any>} result
 */
async function injectSimulationResult(page, result) {
	await page.goto('/fault-simulation/1');
	await page.waitForLoadState('networkidle');

	await page.waitForFunction(() => '__e2eFaultSim' in window, null, { timeout: 10000 });
	await page.evaluate((/** @type {Record<string, any>} */ r) => {
		/** @type {any} */ (window).__e2eFaultSim.injectResult(r);
	}, result);
}

/**
 * Reads the full text content of a Playwright download.
 * @param {import('@playwright/test').Download} download
 * @returns {Promise<string>}
 */
async function readDownloadContent(download) {
	const stream = await download.createReadStream();
	return new Promise((resolve) => {
		let data = '';
		stream.on('data', (/** @type {Buffer} */ chunk) => (data += chunk));
		stream.on('end', () => resolve(data));
	});
}

test.describe('Fault Simulation CSV Export', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeEach(async ({ page }) => {
		const loggedIn = await performLogin(page);
		expect(loggedIn).toBe(true);
	});

	test('CSV export button is visible after simulation and triggers download', async ({ page }) => {
		const mockResult = createMockSimulationResult();
		await injectSimulationResult(page, mockResult);

		const exportButton = page.getByRole('button', {
			name: /export csv|csv exportieren/i
		});
		await exportButton.first().waitFor({ state: 'visible', timeout: 10000 });

		const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
		await exportButton.first().click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toMatch(/^fault-simulation-.+\.csv$/);

		const content = await readDownloadContent(download);

		expect(content).toContain('Section,Trench');
		expect(content).toContain('TR-001-E2E');
		expect(content).toContain('Open Cut');
		expect(content).toContain('Section,Conduits');
		expect(content).toContain('Conduit A');
		expect(content).toContain('Conduit B');
		expect(content).toContain('Section,Cables');
		expect(content).toContain('Cable 1');
		expect(content).toContain('Cable 2');
		expect(content).toContain('Section,Affected Addresses');
		expect(content).toContain('ADDR-001');
		expect(content).toContain('Hauptstraße');
		expect(content).toContain('RU-001');
		expect(content).toContain('RU-002');
		expect(content).toContain('ADDR-002');
	});

	test('CSV filename includes trench ID', async ({ page }) => {
		const mockResult = createMockSimulationResult();
		await injectSimulationResult(page, mockResult);

		const exportButton = page.getByRole('button', {
			name: /export csv|csv exportieren/i
		});
		await exportButton.first().waitFor({ state: 'visible', timeout: 10000 });

		const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
		await exportButton.first().click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('fault-simulation-TR-001-E2E.csv');
	});

	test('CSV export button works on mobile viewport', async ({ page }) => {
		const mockResult = createMockSimulationResult();
		await injectSimulationResult(page, mockResult);

		const exportButton = page.getByRole('button', {
			name: /export csv|csv exportieren/i
		});
		await exportButton.first().waitFor({ state: 'visible', timeout: 10000 });

		await page.setViewportSize({ width: 375, height: 667 });

		const mobileExportButton = page
			.locator('.sm\\:hidden')
			.getByRole('button', { name: /export csv|csv exportieren/i });
		await expect(mobileExportButton).toBeVisible({ timeout: 5000 });

		const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
		await mobileExportButton.click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toMatch(/^fault-simulation-.+\.csv$/);
	});

	test('reset button clears simulation and hides CSV export', async ({ page }) => {
		const mockResult = createMockSimulationResult();
		await injectSimulationResult(page, mockResult);

		const exportButton = page.getByRole('button', {
			name: /export csv|csv exportieren/i
		});
		await exportButton.first().waitFor({ state: 'visible', timeout: 10000 });

		const resetButton = page.getByRole('button', {
			name: /reset|zurücksetzen/i
		});
		await resetButton.first().click();

		await expect(exportButton.first()).not.toBeVisible({ timeout: 5000 });
	});

	test('DamageReport shows trench info and affected data', async ({ page }) => {
		const mockResult = createMockSimulationResult();
		await injectSimulationResult(page, mockResult);

		await expect(page.getByText('TR-001-E2E')).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Open Cut')).toBeVisible();

		await expect(page.getByText(/affected addresses|betroffene adressen/i)).toBeVisible();
		await expect(page.getByRole('link', { name: 'ADDR-001' })).toBeVisible();
	});
});
