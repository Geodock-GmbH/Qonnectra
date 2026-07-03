import path from 'path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_USERNAME = process.env.E2E_TEST_USERNAME;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const API_URL =
	process.env.PUBLIC_API_URL || process.env.API_URL || 'http://localhost:8000/api/v1/';

/**
 * Deletes every pipeline record whose searchable fields match the marker.
 * Runs as a guaranteed teardown so an interrupted or failing test never leaves
 * orphaned rows in the backend. Uses a fresh authenticated API request context
 * (independent of any browser page) so it works even after a mid-suite failure.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} marker - The search term identifying this run's records.
 */
async function deleteRecordsMatching(request, marker) {
	if (!TEST_USERNAME || !TEST_PASSWORD) return;

	const login = await request.post(`${API_URL}auth/login/`, {
		data: { username: TEST_USERNAME, password: TEST_PASSWORD }
	});
	if (!login.ok()) return;

	const listResponse = await request.get(`${API_URL}pipeline-records/`, {
		params: { search: marker, page_size: '200' }
	});
	if (!listResponse.ok()) return;

	const { results = [] } = await listResponse.json();
	for (const record of results) {
		await request.delete(`${API_URL}pipeline-records/${record.uuid}/`);
	}
}

/**
 * Performs a real backend login so requests carry valid auth cookies.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} Whether login succeeded.
 */
async function performLogin(page) {
	if (!TEST_USERNAME || !TEST_PASSWORD) {
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
		return false;
	}
}

/**
 * Opens the pipeline-record detail page for the row containing the given text.
 * @param {import('@playwright/test').Page} page
 * @param {string} organisation - The organisation cell text identifying the row.
 */
async function openRecordByOrganisation(page, organisation) {
	const cell = page
		.locator('[data-testid="pipeline-records-desktop-view"] tbody tr')
		.filter({ hasText: organisation })
		.first();
	await expect(cell).toBeVisible({ timeout: 10000 });
	await cell.click();
	await page.waitForURL(/\/pipeline-records\/[0-9a-f-]{36}/, { timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Pipeline Records CRUD', () => {
	// A unique marker so parallel/reused DBs don't collide and cleanup is precise.
	const ORG = `E2E Org ${Date.now()}`;
	const ORG_EDITED = `${ORG} EDITED`;
	const CONTACT = 'E2E Contact';

	test.beforeEach(async ({ page }) => {
		test.skip(
			!TEST_USERNAME || !TEST_PASSWORD,
			'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env'
		);

		const loginSucceeded = await performLogin(page);
		if (!loginSucceeded) {
			test.skip(true, 'Login failed - test credentials may be invalid');
		}

		await page.goto('/pipeline-records');
		await page.waitForLoadState('networkidle');
	});

	// Guaranteed cleanup: sweep this run's records even if a test fails mid-suite.
	// ORG is a prefix of ORG_EDITED, so searching for it removes both variants.
	test.afterAll(async ({ request }) => {
		await deleteRecordsMatching(request, ORG);
	});

	test('displays the list page with the create button and real columns', async ({ page }) => {
		await expect(page.locator('[data-testid="pipeline-records-page"]')).toBeVisible();
		await expect(page.getByRole('button', { name: /create|erstellen/i })).toBeVisible();
		await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

		const headerRow = page
			.locator('[data-testid="pipeline-records-desktop-view"] thead tr')
			.first();
		await expect(headerRow.getByText(/project|projekt/i)).toBeVisible();
		await expect(headerRow.getByText(/type of work|art der arbeit/i)).toBeVisible();
		await expect(headerRow.getByText(/request reason|grund der anfrage/i)).toBeVisible();
		await expect(headerRow.getByText(/organisation/i)).toBeVisible();
	});

	test('create button navigates to the create route', async ({ page }) => {
		await page.getByRole('button', { name: /create|erstellen/i }).click();
		await page.waitForURL(/\/pipeline-records\/new/, { timeout: 10000 });
		await expect(page.getByRole('heading', { name: /project|projekt/i }).first()).toBeVisible();
	});

	test('project is prefilled from the active project and read-only', async ({ page }) => {
		await page.goto('/pipeline-records/new');
		await page.waitForLoadState('networkidle');

		// The project field mirrors the app's active project selector and cannot be edited here.
		const projectField = page.locator('[data-testid="active-project"]');
		await expect(projectField).toBeVisible();
		await expect(projectField).not.toHaveValue('');
		await expect(projectField).toHaveJSProperty('readOnly', true);

		// With the project prefilled, the submit button is enabled without any selection.
		await expect(page.getByRole('button', { name: /create|erstellen/i })).toBeEnabled();
	});

	test('creates a pipeline record with the active project and shows it in the list', async ({
		page
	}) => {
		await page.goto('/pipeline-records/new');
		await page.waitForLoadState('networkidle');

		const activeProject = (
			await page.locator('[data-testid="active-project"]').inputValue()
		).trim();

		await page.locator('input[name="organisation"]').fill(ORG);
		await page.locator('input[name="name"]').fill(CONTACT);
		await page.locator('input[name="tel"]').fill('0123456789');

		await page.getByRole('button', { name: /create|erstellen/i }).click();

		// Redirects back to the list; the new row must be present with the active project (real write).
		await page.waitForURL(/\/pipeline-records$/, { timeout: 10000 });
		const row = page
			.locator('[data-testid="pipeline-records-desktop-view"] tbody tr')
			.filter({ hasText: ORG });
		await expect(row).toBeVisible({ timeout: 10000 });
		await expect(row).toContainText(CONTACT);
		await expect(row).toContainText(activeProject);
	});

	test('opens a record and shows the form prefilled', async ({ page }) => {
		await openRecordByOrganisation(page, ORG);

		await expect(page.locator('input[name="organisation"]')).toHaveValue(ORG);
		await expect(page.locator('input[name="name"]')).toHaveValue(CONTACT);
		await expect(page.locator('input[name="tel"]')).toHaveValue('0123456789');
		// The project combobox is preselected by resolving the record's project name.
		await expect(
			page.locator('label.label', { hasText: 'Projekt' }).getByRole('combobox')
		).not.toHaveValue('');
	});

	test('edits a record and persists the change', async ({ page }) => {
		await openRecordByOrganisation(page, ORG);

		await page.locator('input[name="organisation"]').fill(ORG_EDITED);
		await page.getByRole('button', { name: /save|speichern/i }).click();

		// Go back to the list and confirm the edited value is really persisted.
		await page.goto('/pipeline-records');
		await page.waitForLoadState('networkidle');
		await expect(
			page
				.locator('[data-testid="pipeline-records-desktop-view"] tbody tr')
				.filter({ hasText: ORG_EDITED })
		).toBeVisible({ timeout: 10000 });
	});

	test('deletes a record after confirmation and removes it from the list', async ({ page }) => {
		await openRecordByOrganisation(page, ORG_EDITED);

		await page.getByRole('button', { name: /delete|löschen/i }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10000 });
		await dialog.getByRole('button', { name: /delete|löschen/i }).click();

		// Redirects to the list; the row must be gone (real delete).
		await page.waitForURL(/\/pipeline-records$/, { timeout: 10000 });
		await expect(
			page
				.locator('[data-testid="pipeline-records-desktop-view"] tbody tr')
				.filter({ hasText: ORG_EDITED })
		).toHaveCount(0, { timeout: 10000 });
	});
});
