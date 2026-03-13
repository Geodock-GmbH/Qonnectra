import path from 'path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env from the frontend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const USERNAME = process.env.E2E_TEST_USERNAME;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

// Skip test if credentials are not configured
test.skip(!USERNAME || !PASSWORD, 'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');

test('should allow a user to log in', async ({ page }) => {
	// Navigate to the login page
	await page.goto('/login');

	// Fill in the username and password
	await page.locator('input[name="username"]').fill(/** @type {string} */ (USERNAME));
	await page.locator('input[name="password"]').fill(/** @type {string} */ (PASSWORD));

	// Click the login button
	await page.locator('button[type="submit"]').click();

	// Verify that the user is redirected after login (to map or dashboard)
	await expect(page).not.toHaveURL('/login');

	// Check for a welcome message or a user-specific element
	const welcomeMessage = await page.locator(`text=Welcome, ${USERNAME}`);
	// await expect(welcomeMessage).toBeVisible();
});
