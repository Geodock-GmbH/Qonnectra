import path from 'path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const USERNAME = process.env.E2E_TEST_USERNAME;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!USERNAME || !PASSWORD, 'E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in .env');

test('should allow a user to log in', async ({ page }) => {
	await page.goto('/login');

	await page.locator('input[name="username"]').fill(/** @type {string} */ (USERNAME));
	await page.locator('input[name="password"]').fill(/** @type {string} */ (PASSWORD));

	await page.locator('button[type="submit"]').click();

	await expect(page).not.toHaveURL('/login');

	const welcomeMessage = await page.locator(`text=Welcome, ${USERNAME}`);
	// await expect(welcomeMessage).toBeVisible();
});
