import { expect, test } from '@playwright/test';

test('should allow a user to log in', async ({ page }) => {
	console.log(page.url());
	// Navigate to the login page
	await page.goto('/login');

	// Fill in the username and password
	await page.locator('input[name="username"]').fill('rainer_zufall');
	await page.locator('input[name="password"]').fill('testuser');

	// Click the login button
	await page.locator('button[type="submit"]').click();

	// Verify that the user is redirected to the map page
	await expect(page).toHaveURL('/map');

	// Check for a welcome message or a user-specific element
	const welcomeMessage = await page.locator('text=Welcome, rainer_zufall');
	// await expect(welcomeMessage).toBeVisible();
});
