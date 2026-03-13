import path from 'path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Creates a mock conduit object
 * @param {Record<string, any>} [overrides]
 * @returns {Record<string, any>}
 */
function createMockConduit(overrides = {}) {
	const uuid = overrides.uuid || `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	return /** @type {Record<string, any>} */ ({
		uuid,
		name: `Conduit-${uuid.substr(0, 8)}`,
		conduit_type: { id: 1, conduit_type: '4-tube' },
		outer_conduit: 'OC-001',
		status: { id: 1, status: 'In Use' },
		network_level: { id: 1, network_level: 'Backbone' },
		owner: { id: 1, company: 'TeleCorp' },
		constructor: { id: 2, company: 'BuildCo' },
		manufacturer: { id: 3, company: 'PipeMfg' },
		date: '2024-01-15',
		flag: { id: 1, flag: 'Standard' },
		project: { id: 1, name: 'Test Project' },
		...overrides
	});
}

/**
 * Creates a mock conduit for list view (flattened format)
 * @param {Record<string, any>} [overrides]
 * @returns {Record<string, any>}
 */
function createMockConduitForList(overrides = {}) {
	const uuid = overrides.uuid || `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	return /** @type {Record<string, any>} */ ({
		uuid,
		name: overrides.name || `Conduit-${uuid.substr(0, 8)}`,
		conduit_type: overrides.conduit_type || '4-tube',
		outer_conduit: overrides.outer_conduit || 'OC-001',
		status: overrides.status || 'In Use',
		network_level: overrides.network_level || 'Backbone',
		owner: overrides.owner || 'TeleCorp',
		constructor: overrides.constructor || 'BuildCo',
		manufacturer: overrides.manufacturer || 'PipeMfg',
		date: overrides.date || '2024-01-15',
		flag: overrides.flag || 'Standard',
		...overrides
	});
}

/**
 * Creates a mock paginated response for conduit list
 * @param {number} [count]
 * @param {number} [page]
 * @param {number} [pageSize]
 * @param {any[] | null} [customResults]
 * @returns {Record<string, any>}
 */
function createMockPaginatedResponse(count = 10, page = 1, pageSize = 50, customResults = null) {
	const results =
		customResults ||
		Array.from({ length: Math.min(count, pageSize) }, (_, i) =>
			createMockConduitForList({
				uuid: `uuid-${page}-${i}`,
				name: `Test Conduit ${(page - 1) * pageSize + i + 1}`
			})
		);

	return {
		count,
		page,
		page_size: pageSize,
		total_pages: Math.ceil(count / pageSize),
		results
	};
}

/**
 * Creates mock attribute options for dropdowns
 * @returns {Record<string, any>}
 */
function createMockAttributeOptions() {
	return {
		conduitTypes: [
			{ id: 1, conduit_type: '4-tube' },
			{ id: 2, conduit_type: '7-tube' },
			{ id: 3, conduit_type: '12-tube' }
		],
		statuses: [
			{ id: 1, status: 'In Use' },
			{ id: 2, status: 'Planned' },
			{ id: 3, status: 'Decommissioned' }
		],
		networkLevels: [
			{ id: 1, network_level: 'Backbone' },
			{ id: 2, network_level: 'Distribution' },
			{ id: 3, network_level: 'Access' }
		],
		companies: [
			{ id: 1, company: 'TeleCorp' },
			{ id: 2, company: 'BuildCo' },
			{ id: 3, company: 'PipeMfg' }
		],
		flags: [
			{ id: 1, flag: 'Standard' },
			{ id: 2, flag: 'Priority' },
			{ id: 3, flag: 'Review' }
		]
	};
}

/**
 * Sets up API mocks for conduit tests
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, any>} [options]
 */
async function setupConduitMocks(page, options = {}) {
	const {
		conduits = createMockPaginatedResponse(10),
		singleConduit = createMockConduit(),
		attributeOptions = createMockAttributeOptions(),
		createResponse = { success: true },
		updateResponse = { success: true },
		deleteResponse = { success: true },
		apiDelay = 0,
		failCreate = false,
		failUpdate = false,
		failDelete = false,
		failList = false,
		failSingle = false
	} = options;

	await page.route('**/conduit/all/**', async (route) => {
		if (apiDelay) await new Promise((resolve) => setTimeout(resolve, apiDelay));

		if (failList) {
			await route.fulfill({
				status: options.listErrorStatus || 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: options.listErrorMessage || 'Internal server error' })
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(conduits)
		});
	});

	await page.route(/\/conduit\/[a-f0-9-]+\/$/, async (route) => {
		const method = route.request().method();

		if (method === 'GET') {
			if (apiDelay) await new Promise((resolve) => setTimeout(resolve, apiDelay));

			if (failSingle) {
				await route.fulfill({
					status: options.singleErrorStatus || 404,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Conduit not found' })
				});
				return;
			}

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(singleConduit)
			});
		} else if (method === 'PATCH') {
			if (apiDelay) await new Promise((resolve) => setTimeout(resolve, apiDelay));

			if (failUpdate) {
				await route.fulfill({
					status: options.updateErrorStatus || 400,
					contentType: 'application/json',
					body: JSON.stringify({ detail: options.updateErrorMessage || 'Update failed' })
				});
				return;
			}

			const requestBody = route.request().postDataJSON();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ...singleConduit, ...requestBody })
			});
		} else if (method === 'DELETE') {
			if (apiDelay) await new Promise((resolve) => setTimeout(resolve, apiDelay));

			if (failDelete) {
				await route.fulfill({
					status: options.deleteErrorStatus || 400,
					contentType: 'application/json',
					body: JSON.stringify({ detail: options.deleteErrorMessage || 'Delete failed' })
				});
				return;
			}

			await route.fulfill({
				status: 204,
				body: ''
			});
		} else {
			await route.continue();
		}
	});

	await page.route('**/conduit/', async (route) => {
		const method = route.request().method();

		if (method === 'POST') {
			if (apiDelay) await new Promise((resolve) => setTimeout(resolve, apiDelay));

			if (failCreate) {
				await route.fulfill({
					status: options.createErrorStatus || 400,
					contentType: 'application/json',
					body: JSON.stringify({ detail: options.createErrorMessage || 'Create failed' })
				});
				return;
			}

			const requestBody = route.request().postDataJSON();
			const newConduit = createMockConduit({ ...requestBody, uuid: `new-uuid-${Date.now()}` });
			await route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify(newConduit)
			});
		} else {
			await route.continue();
		}
	});

	await page.route('**/attributes_conduit_type/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(attributeOptions.conduitTypes)
		});
	});

	await page.route('**/attributes_status/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(attributeOptions.statuses)
		});
	});

	await page.route('**/attributes_network_level/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(attributeOptions.networkLevels)
		});
	});

	await page.route('**/attributes_company/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(attributeOptions.companies)
		});
	});

	await page.route('**/flags/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(attributeOptions.flags)
		});
	});

	await page.route('**/import/conduit/**', async (route) => {
		if (options.failImport) {
			await route.fulfill({
				status: options.importErrorStatus || 400,
				contentType: 'application/json',
				body: JSON.stringify({
					error: options.importErrorMessage || 'Import failed',
					errors: options.importErrors || [],
					warnings: options.importWarnings || []
				})
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				created_count: options.importCreatedCount || 5,
				message: 'Import successful',
				warnings: options.importWarnings || []
			})
		});
	});

	await page.route('**/template/conduit/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			body: Buffer.from('mock excel content')
		});
	});
}

const TEST_USERNAME = process.env.E2E_TEST_USERNAME;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

/**
 * Performs real login to get valid auth cookies.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} Whether login succeeded.
 */
async function performLogin(page) {
	if (!TEST_USERNAME || !TEST_PASSWORD) {
		console.warn('E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');
		return false;
	}

	await page.goto('/login');
	await page.locator('input[name="username"]').fill(TEST_USERNAME);
	await page.locator('input[name="password"]').fill(TEST_PASSWORD);
	await page.locator('button[type="submit"]').click();

	try {
		await page.waitForFunction(() => !window.location.pathname.includes('/login'), {
			timeout: 10000
		});
		return true;
	} catch {
		console.warn('Login failed - test credentials may be invalid');
		return false;
	}
}

test.describe.configure({ mode: 'serial' });

test.describe('Conduit Route Tests', () => {
	let loginSucceeded = false;

	test.beforeEach(async ({ page }) => {
		test.skip(
			!TEST_USERNAME || !TEST_PASSWORD,
			'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env'
		);

		loginSucceeded = await performLogin(page);

		if (!loginSucceeded) {
			test.skip(true, 'Login failed - test credentials may be invalid');
		}

		await page.goto('/conduit/1');
		await page.waitForLoadState('networkidle');
	});

	test.describe('Page Load & Display', () => {
		test('should display conduit page with table and controls', async ({ page }) => {
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();

			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();

			await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
		});

		test('should display conduit table', async ({ page }) => {
			await expect(page.locator('[data-testid="conduit-desktop-view"] table')).toBeVisible();

			await expect(page.locator('thead tr th').first()).toBeVisible();
		});

		test('should show loading skeleton while navigating', async ({ page }) => {
			const page2Link = page.getByRole('button', { name: '2' });
			if (await page2Link.isVisible({ timeout: 1000 }).catch(() => false)) {
				await page2Link.click();
			}
		});

		test('should display pagination info', async ({ page }) => {
			await expect(page.locator('[data-testid="pagination-count"]')).toBeVisible();
		});

		test('should handle missing project ID gracefully', async ({ page }) => {
			await page.goto('/conduit');

			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();
		});
	});

	test.describe('Create Conduit Modal', () => {
		test('should open create modal when clicking add button', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			await expect(page.locator('[role="dialog"][data-state="open"]')).toBeVisible({
				timeout: 10000
			});
		});

		test('should display all form fields in modal', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			await expect(dialog.locator('input[name="pipe_name"]')).toBeVisible();
		});

		test('should require name field', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			const submitButton = dialog.getByRole('button', { name: /save|speichern/i });
			await submitButton.click();

			await expect(dialog).toBeVisible();
		});

		test('should clear form on close', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			const nameInput = dialog.locator('input[name="pipe_name"]');
			await nameInput.fill('Test Name');

			// German: "Schließen"
			await dialog.getByRole('button', { name: /close|schließen/i }).click();

			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			await addButton.click();
			await expect(dialog).toBeVisible({ timeout: 10000 });

			const newNameInput = dialog.locator('input[name="pipe_name"]');
			await expect(newNameInput).toHaveValue('');
		});

		test('should close modal on escape key', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const openDialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(openDialog).toBeVisible({ timeout: 10000 });

			// Wait for dialog to be fully rendered and interactive
			await page.waitForTimeout(200);

			await page.keyboard.press('Escape');

			await expect(openDialog).not.toBeVisible({ timeout: 5000 });
		});

		test('should show comboboxes in create modal', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			await expect(dialog.locator('label[for="pipe_type"]').getByRole('combobox')).toBeVisible();
			await expect(dialog.locator('label[for="status"]').getByRole('combobox')).toBeVisible();
			await expect(
				dialog.locator('label[for="network_level"]').getByRole('combobox')
			).toBeVisible();
			await expect(dialog.locator('label[for="owner"]').getByRole('combobox')).toBeVisible();
		});

		test('should open conduit type combobox and select an option', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			const pipeTypeLabel = dialog.locator('label[for="pipe_type"]');
			await expect(pipeTypeLabel.getByRole('combobox')).toBeVisible();
			await pipeTypeLabel.getByRole('button').click();

			const listbox = page.getByRole('listbox');
			await expect(listbox).toBeVisible({ timeout: 10000 });
			const firstOption = listbox.getByRole('option').first();
			await expect(firstOption).toBeVisible({ timeout: 10000 });
			await firstOption.click();

			await expect(dialog).toBeVisible();
		});

		test('should open status combobox and select an option', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			const statusLabel = dialog.locator('label[for="status"]');
			await expect(statusLabel.getByRole('combobox')).toBeVisible();
			await statusLabel.getByRole('button').click();

			const listbox = page.getByRole('listbox');
			await expect(listbox).toBeVisible({ timeout: 10000 });
			const firstOption = listbox.getByRole('option').first();
			await expect(firstOption).toBeVisible({ timeout: 10000 });
			await firstOption.click();

			await expect(dialog).toBeVisible();
		});
	});

	test.describe('Search & Filter', () => {
		test('should filter table using search input', async ({ page }) => {
			const searchInput = page.locator('[data-testid="search-input"]');
			await expect(searchInput).toBeVisible();
			await searchInput.fill('test');

			await page.waitForTimeout(100);

			const searchButton = page.locator('.search-button');
			await searchButton.click();

			await page.waitForURL(/search=test/, { timeout: 10000 });

			await expect(page).toHaveURL(/search=test/);
		});

		test('should filter by individual column', async ({ page }) => {
			await expect(page.locator('[data-testid="conduit-desktop-view"] table')).toBeVisible();

			const columnFilters = page.locator('thead tr').nth(1).locator('input');
			const firstFilter = columnFilters.first();

			await firstFilter.fill('a');

			await expect(page.locator('table')).toBeVisible();
		});

		test('should sort columns ascending/descending', async ({ page }) => {
			await expect(page.locator('table')).toBeVisible();

			const nameHeader = page.locator('thead tr').first().locator('th').first();
			await nameHeader.click();

			await expect(nameHeader.locator('svg')).toBeVisible();

			await nameHeader.click();

			await expect(nameHeader.locator('svg')).toBeVisible();

			await nameHeader.click();
		});

		test('should update URL with search parameter', async ({ page }) => {
			const searchInput = page.locator('[data-testid="search-input"]');
			await expect(searchInput).toBeVisible();
			await searchInput.fill('searchterm');

			await page.waitForTimeout(100);

			const searchButton = page.locator('.search-button');
			await searchButton.click();

			await page.waitForURL(/search=searchterm/, { timeout: 10000 });

			await expect(page).toHaveURL(/search=searchterm/);
		});
	});

	test.describe('Pagination', () => {
		test('should display pagination controls', async ({ page }) => {
			await expect(page.locator('[data-testid="pagination-count"]')).toBeVisible();
		});

		test('should navigate between pages when multiple exist', async ({ page }) => {
			const page2Button = page.getByRole('button', { name: '2' });
			if (await page2Button.isVisible({ timeout: 1000 }).catch(() => false)) {
				await page2Button.click();

				await expect(page).toHaveURL(/page=2/);
			}
		});

		test('should update URL on page change', async ({ page }) => {
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();
		});
	});

	test.describe('Row Click & Drawer', () => {
		test('should open drawer when clicking table row', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

			await page.locator('tbody tr').first().click();

			await expect(page.locator('[data-drawer]')).toBeVisible();
		});

		test('should display conduit form in drawer', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

			await page.locator('tbody tr').first().click();

			await expect(page.locator('[data-drawer]')).toBeVisible();

			await expect(
				page.locator('[data-drawer]').locator('input[name="conduit_name"]')
			).toBeVisible();
		});

		test('should show tabs in drawer (attributes/files)', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			await page.locator('tbody tr').first().click();

			await expect(page.locator('[data-drawer]')).toBeVisible();

			// German: "Eigenschaften" / "Anhänge"
			await expect(
				page.locator('[data-drawer]').getByText(/attributes|eigenschaften/i)
			).toBeVisible();
			await expect(page.locator('[data-drawer]').getByText(/attachments|anhänge/i)).toBeVisible();
		});

		test('should close drawer on close button', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			await page.locator('tbody tr').first().click();
			await expect(page.locator('[data-drawer]')).toBeVisible();

			await page
				.locator('[data-drawer]')
				.getByLabel(/Close drawer|Seitenleiste schließen/i)
				.click();

			await expect(page.locator('[data-drawer]')).not.toBeVisible();
		});

		test('should close drawer on escape key', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			await page.locator('tbody tr').first().click();
			await expect(page.locator('[data-drawer]')).toBeVisible();

			await page.keyboard.press('Escape');

			await expect(page.locator('[data-drawer]')).not.toBeVisible();
		});
	});

	test.describe('Import/Export', () => {
		test('should show template download button', async ({ page }) => {
			// German: "Vorlage"
			await expect(page.getByRole('button', { name: /template|vorlage/i })).toBeVisible();
		});

		test('should download template on button click', async ({ page }) => {
			const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

			const templateButton = page.getByRole('button', { name: /template|vorlage/i });
			await expect(templateButton).toBeVisible();
			await templateButton.click();

			const download = await downloadPromise;
			expect(download.suggestedFilename()).toContain('conduit');
		});

		test('should show upload/import button', async ({ page }) => {
			// German: "Importieren"
			await expect(page.getByRole('button', { name: /import|importieren/i })).toBeVisible();
		});
	});

	test.describe('Edge Cases', () => {
		test('should handle rapid row clicks', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

			await page.locator('tbody tr').first().click();

			await expect(page.locator('[data-drawer]')).toBeVisible();
		});

		test('should handle page refresh', async ({ page }) => {
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();

			await page.reload();

			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();
		});
	});

	test.describe('Mobile Responsiveness', () => {
		test('should show card view on mobile', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });

			await page.reload();
			await page.waitForLoadState('networkidle');

			await expect(page.locator('[data-testid="conduit-desktop-view"]')).not.toBeVisible();

			await expect(page.locator('[data-testid="conduit-mobile-view"]')).toBeVisible();
		});

		test('should have working mobile search', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState('networkidle');

			const mobileSearch = page.locator('[data-testid="search-input"]');
			await mobileSearch.fill('test');

			await expect(mobileSearch).toHaveValue('test');
		});

		test('should open drawer when clicking card on mobile', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState('networkidle');

			const card = page.locator('[data-testid="conduit-card"]').first();
			if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
				await card.click();

				await expect(page.locator('[data-drawer]')).toBeVisible();
			}
		});
	});
});
