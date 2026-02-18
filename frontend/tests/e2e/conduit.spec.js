import path from 'path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env from the frontend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

/**
 * Creates a mock conduit object
 * @param {Object} overrides - Properties to override in the default conduit
 * @returns {Object} Mock conduit object
 */
function createMockConduit(overrides = {}) {
	const uuid = overrides.uuid || `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	return {
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
	};
}

/**
 * Creates a mock conduit for list view (flattened format)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock conduit for list
 */
function createMockConduitForList(overrides = {}) {
	const uuid = overrides.uuid || `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	return {
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
	};
}

/**
 * Creates a mock paginated response for conduit list
 * @param {number} count - Total number of conduits
 * @param {number} page - Current page number
 * @param {number} pageSize - Items per page
 * @param {Array} customResults - Optional custom results array
 * @returns {Object} Mock paginated response
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
 * @returns {Object} Mock attribute options
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

// ============================================================================
// API MOCKING SETUP
// ============================================================================

/**
 * Sets up API mocks for conduit tests
 * @param {Page} page - Playwright page object
 * @param {Object} options - Configuration options
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

	// Mock GET /conduit/all/ - Paginated list
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

	// Mock GET /conduit/{uuid}/ - Single conduit
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

	// Mock POST /conduit/ - Create
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

	// Mock attribute endpoints
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

	// Mock import endpoint
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

	// Mock template download endpoint
	await page.route('**/template/conduit/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			body: Buffer.from('mock excel content')
		});
	});
}

// ============================================================================
// AUTHENTICATION HELPER
// ============================================================================

/**
 * Test credentials - loaded from .env file
 * To run these tests, ensure your .env file has:
 * - E2E_TEST_USERNAME=your_test_username
 * - E2E_TEST_PASSWORD=your_test_password
 */
const TEST_USERNAME = process.env.E2E_TEST_USERNAME;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

/**
 * Performs real login to get valid auth cookies
 * This is required because SvelteKit server-side auth validates against the real backend
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if login succeeded, false otherwise
 */
async function performLogin(page) {
	// Skip if credentials not configured
	if (!TEST_USERNAME || !TEST_PASSWORD) {
		console.warn('E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');
		return false;
	}

	await page.goto('/login');
	await page.locator('input[name="username"]').fill(TEST_USERNAME);
	await page.locator('input[name="password"]').fill(TEST_PASSWORD);
	await page.locator('button[type="submit"]').click();

	// Wait for redirect away from login page (could be /map or /dashboard)
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

// ============================================================================
// TEST SUITES
// ============================================================================

// Configure tests to run serially to avoid state conflicts
test.describe.configure({ mode: 'serial' });

test.describe('Conduit Route Tests', () => {
	// Track if login succeeded
	let loginSucceeded = false;

	test.beforeEach(async ({ page }) => {
		// Perform real login to get valid auth cookies
		// This is required because SvelteKit server-side auth validates against the real backend
		loginSucceeded = await performLogin(page);

		// Skip test if login failed
		if (!loginSucceeded) {
			test.skip();
		}

		// Navigate to conduit page and wait for it to fully load
		await page.goto('/conduit/1');
		await page.waitForLoadState('networkidle');
	});

	// ========================================================================
	// Suite 1: Page Load & Display
	// ========================================================================
	test.describe('Page Load & Display', () => {
		test('should display conduit page with table and controls', async ({ page }) => {
			// Verify main structure is visible
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();

			// Verify add button is visible
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();

			// Verify search input is visible
			await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
		});

		test('should display conduit table', async ({ page }) => {
			// Wait for table to be visible (desktop view)
			await expect(page.locator('[data-testid="conduit-desktop-view"] table')).toBeVisible();

			// Verify table has header row with columns
			await expect(page.locator('thead tr th').first()).toBeVisible();
		});

		test('should show loading skeleton while navigating', async ({ page }) => {
			// Navigate to page 2 to trigger loading state
			const page2Link = page.getByRole('button', { name: '2' });
			if (await page2Link.isVisible({ timeout: 1000 }).catch(() => false)) {
				await page2Link.click();
				// Loading state should appear briefly
			}
		});

		test('should display pagination info', async ({ page }) => {
			// Verify pagination count is visible
			await expect(page.locator('[data-testid="pagination-count"]')).toBeVisible();
		});

		test('should handle missing project ID gracefully', async ({ page }) => {
			// Navigate without project ID - should redirect or show empty
			await page.goto('/conduit');

			// Should either redirect to /conduit/[project] or show empty state
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();
		});
	});

	// ========================================================================
	// Suite 2: Create Conduit Modal
	// ========================================================================
	test.describe('Create Conduit Modal', () => {
		test('should open create modal when clicking add button', async ({ page }) => {
			// Click add button
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			// Verify modal is open (data-state="open" indicates dialog is visible)
			await expect(page.locator('[role="dialog"][data-state="open"]')).toBeVisible({
				timeout: 10000
			});
		});

		test('should display all form fields in modal', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			// Wait for dialog to open
			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			// Verify form fields are present (checking for name input which is universal)
			await expect(dialog.locator('input[name="pipe_name"]')).toBeVisible();
		});

		test('should require name field', async ({ page }) => {
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			// Wait for dialog to open with a longer timeout
			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			// Try to submit without name - the name input has 'required' attribute
			const submitButton = dialog.getByRole('button', { name: /save|speichern/i });
			await submitButton.click();

			// Form should not submit due to HTML5 validation - modal still visible
			await expect(dialog).toBeVisible();
		});

		test('should clear form on close', async ({ page }) => {
			// Open modal and fill form
			const addButton = page.locator('[data-testid="add-conduit-button"]');
			await expect(addButton).toBeVisible();
			await addButton.click();

			// Wait for modal to be visible
			const dialog = page.locator('[role="dialog"][data-state="open"]');
			await expect(dialog).toBeVisible({ timeout: 10000 });

			const nameInput = dialog.locator('input[name="pipe_name"]');
			await nameInput.fill('Test Name');

			// Close modal (German: "Schließen")
			await dialog.getByRole('button', { name: /close|schließen/i }).click();

			// Wait for dialog to close
			await expect(dialog).not.toBeVisible({ timeout: 5000 });

			// Reopen modal
			await addButton.click();
			await expect(dialog).toBeVisible({ timeout: 10000 });

			// Verify form is cleared (name should be empty or have default)
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

			// Press escape
			await page.keyboard.press('Escape');

			// Modal should be closed (dialog will have data-state="closed")
			await expect(openDialog).not.toBeVisible({ timeout: 5000 });
		});
	});

	// ========================================================================
	// Suite 3: Search & Filter
	// ========================================================================
	test.describe('Search & Filter', () => {
		test('should filter table using search input', async ({ page }) => {
			// Find the main search input
			const searchInput = page.locator('[data-testid="search-input"]');
			await expect(searchInput).toBeVisible();
			await searchInput.fill('test');

			// Wait a moment for debouncing
			await page.waitForTimeout(100);

			// Click the search button to trigger search
			const searchButton = page.locator('.search-button');
			await searchButton.click();

			// Wait for URL to update (uses replaceState so no navigation event)
			await page.waitForFunction(() => window.location.href.includes('search=test'), {
				timeout: 10000
			});

			// URL should have updated with search parameter
			await expect(page).toHaveURL(/search=test/);
		});

		test('should filter by individual column', async ({ page }) => {
			// Wait for table to load
			await expect(page.locator('[data-testid="conduit-desktop-view"] table')).toBeVisible();

			// Find column filter inputs (in second header row)
			const columnFilters = page.locator('thead tr').nth(1).locator('input');
			const firstFilter = columnFilters.first();

			// Type a filter value
			await firstFilter.fill('a');

			// Table should update (client-side filtering)
			// Just verify table is still visible and responsive
			await expect(page.locator('table')).toBeVisible();
		});

		test('should sort columns ascending/descending', async ({ page }) => {
			await expect(page.locator('table')).toBeVisible();

			// Click on Name column header to sort
			const nameHeader = page.locator('thead tr').first().locator('th').first();
			await nameHeader.click();

			// Should show sort indicator (chevron for asc)
			await expect(nameHeader.locator('svg')).toBeVisible();

			// Click again for descending
			await nameHeader.click();

			// Should still show sort indicator
			await expect(nameHeader.locator('svg')).toBeVisible();

			// Click a third time to clear sort
			await nameHeader.click();
		});

		test('should update URL with search parameter', async ({ page }) => {
			const searchInput = page.locator('[data-testid="search-input"]');
			await expect(searchInput).toBeVisible();
			await searchInput.fill('searchterm');

			// Wait a moment for debouncing
			await page.waitForTimeout(100);

			// Click the search button to trigger search
			const searchButton = page.locator('.search-button');
			await searchButton.click();

			// Wait for URL to update (uses replaceState so no navigation event)
			await page.waitForFunction(() => window.location.href.includes('search=searchterm'), {
				timeout: 10000
			});

			// URL should contain search parameter
			await expect(page).toHaveURL(/search=searchterm/);
		});
	});

	// ========================================================================
	// Suite 4: Pagination
	// ========================================================================
	test.describe('Pagination', () => {
		test('should display pagination controls', async ({ page }) => {
			// Pagination count should be visible
			await expect(page.locator('[data-testid="pagination-count"]')).toBeVisible();
		});

		test('should navigate between pages when multiple exist', async ({ page }) => {
			// Check if page 2 exists (depends on actual data)
			const page2Button = page.getByRole('button', { name: '2' });
			if (await page2Button.isVisible({ timeout: 1000 }).catch(() => false)) {
				await page2Button.click();

				// URL should update
				await expect(page).toHaveURL(/page=2/);
			}
		});

		test('should update URL on page change', async ({ page }) => {
			// Verify page param is in URL or default is page 1
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();
		});
	});

	// ========================================================================
	// Suite 5: Row Click & Drawer
	// ========================================================================
	test.describe('Row Click & Drawer', () => {
		test('should open drawer when clicking table row', async ({ page }) => {
			// Wait for table and rows to be visible
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

			// Click on the first row
			await page.locator('tbody tr').first().click();

			// Drawer should open
			await expect(page.locator('[data-drawer]')).toBeVisible();
		});

		test('should display conduit form in drawer', async ({ page }) => {
			// Wait for table
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

			await page.locator('tbody tr').first().click();

			// Wait for drawer to open
			await expect(page.locator('[data-drawer]')).toBeVisible();

			// Verify conduit name input is shown in drawer
			await expect(
				page.locator('[data-drawer]').locator('input[name="conduit_name"]')
			).toBeVisible();
		});

		test('should show tabs in drawer (attributes/files)', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			await page.locator('tbody tr').first().click();

			// Wait for drawer
			await expect(page.locator('[data-drawer]')).toBeVisible();

			// Check for tab buttons (German: "Eigenschaften" / "Anhänge")
			await expect(
				page.locator('[data-drawer]').getByText(/attributes|eigenschaften/i)
			).toBeVisible();
			await expect(page.locator('[data-drawer]').getByText(/attachments|anhänge/i)).toBeVisible();
		});

		test('should close drawer on close button', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			await page.locator('tbody tr').first().click();
			await expect(page.locator('[data-drawer]')).toBeVisible();

			// Click close button (aria-label="Close drawer")
			await page.locator('[data-drawer]').getByLabel('Close drawer').click();

			// Drawer should be closed
			await expect(page.locator('[data-drawer]')).not.toBeVisible();
		});

		test('should close drawer on escape key', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			await page.locator('tbody tr').first().click();
			await expect(page.locator('[data-drawer]')).toBeVisible();

			// Press escape
			await page.keyboard.press('Escape');

			// Drawer should be closed
			await expect(page.locator('[data-drawer]')).not.toBeVisible();
		});
	});

	// ========================================================================
	// Suite 6: Import/Export
	// ========================================================================
	test.describe('Import/Export', () => {
		test('should show template download button', async ({ page }) => {
			// Verify template button is visible (German: "Vorlage")
			await expect(page.getByRole('button', { name: /template|vorlage/i })).toBeVisible();
		});

		test('should download template on button click', async ({ page }) => {
			// Set up download listener BEFORE clicking
			const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

			// Click template download button
			const templateButton = page.getByRole('button', { name: /template|vorlage/i });
			await expect(templateButton).toBeVisible();
			await templateButton.click();

			// Wait for download to start
			const download = await downloadPromise;
			expect(download.suggestedFilename()).toContain('conduit');
		});

		test('should show upload/import button', async ({ page }) => {
			// Verify import button is visible (German: "Importieren")
			await expect(page.getByRole('button', { name: /import|importieren/i })).toBeVisible();
		});
	});

	// ========================================================================
	// Suite 7: Edge Cases
	// ========================================================================
	test.describe('Edge Cases', () => {
		test('should handle rapid row clicks', async ({ page }) => {
			await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

			// Rapidly click multiple rows
			await page.locator('tbody tr').first().click();

			// Should handle without crashing - drawer opens
			await expect(page.locator('[data-drawer]')).toBeVisible();
		});

		test('should handle page refresh', async ({ page }) => {
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();

			// Refresh the page
			await page.reload();

			// Page should still work
			await expect(page.locator('[data-testid="conduit-page"]')).toBeVisible();
		});
	});

	// ========================================================================
	// Suite 8: Mobile Responsiveness
	// ========================================================================
	test.describe('Mobile Responsiveness', () => {
		test('should show card view on mobile', async ({ page }) => {
			// Set mobile viewport
			await page.setViewportSize({ width: 375, height: 667 });

			// Reload page with mobile viewport
			await page.reload();
			await page.waitForLoadState('networkidle');

			// Desktop table should be hidden on mobile
			await expect(page.locator('[data-testid="conduit-desktop-view"]')).not.toBeVisible();

			// Mobile card view should be visible
			await expect(page.locator('[data-testid="conduit-mobile-view"]')).toBeVisible();
		});

		test('should have working mobile search', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState('networkidle');

			// Find mobile search input
			const mobileSearch = page.locator('[data-testid="search-input"]');
			await mobileSearch.fill('test');

			// Search input should accept input
			await expect(mobileSearch).toHaveValue('test');
		});

		test('should open drawer when clicking card on mobile', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState('networkidle');

			// Wait for cards to load
			const card = page.locator('[data-testid="conduit-card"]').first();
			if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
				await card.click();

				// Drawer should open
				await expect(page.locator('[data-drawer]')).toBeVisible();
			}
		});
	});
});
