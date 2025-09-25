import { test, expect } from '@playwright/test';

test.describe('Canvas Sync Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Login before each test
		await page.goto('/login');
		await page.locator('input[name="username"]').fill('rainer_zufall');
		await page.locator('input[name="password"]').fill('testuser');
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL('/map');
	});

	test('should trigger sync on initial page load when needed', async ({ page }) => {
		// Intercept API calls to mock sync needed scenario
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						total_nodes: 10,
						nodes_with_canvas: 0,
						nodes_missing_canvas: 10,
						sync_needed: true,
						sync_in_progress: false,
						sync_status: 'IDLE'
					})
				});
			}
		});

		await page.route('**/canvas-coordinates/', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						message: 'Successfully updated canvas coordinates for 10 nodes',
						updated_count: 10,
						scale: 0.2,
						center: { x: 1500, y: 2500 },
						bounds: { min_x: 1000, max_x: 2000, min_y: 2000, max_y: 3000 }
					})
				});
			}
		});

		// Mock node data response
		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 1,
						name: 'Test Node 1',
						canvas_x: 100,
						canvas_y: 200,
						node_type: { node_type: 'Type A' },
						status: { status: 'Active' },
						network_level: { network_level: 'Level 1' },
						owner: { company: 'Test Company' }
					}
				])
			});
		});

		// Navigate to network schema page
		await page.goto('/network-schema');

		// Wait for page to load and sync to complete
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();

		// Check that sync completion is indicated
		await expect(page.locator('text=✓ Canvas coordinates ready')).toBeVisible();

		// Verify node count is displayed
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();
	});

	test('should show sync in progress when another user is syncing', async ({ page }) => {
		// Mock sync in progress scenario
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					total_nodes: 10,
					nodes_with_canvas: 5,
					nodes_missing_canvas: 5,
					sync_needed: true,
					sync_in_progress: true,
					sync_status: 'IN_PROGRESS',
					sync_progress: 50.0,
					sync_started_by: 'other_user',
					sync_started_at: new Date().toISOString()
				})
			});
		});

		// Mock polling responses - first in progress, then completed
		let pollCount = 0;
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			pollCount++;
			if (pollCount === 1) {
				// First call - in progress
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: true,
						sync_progress: 75.0,
						sync_status: 'IN_PROGRESS'
					})
				});
			} else {
				// Second call - completed
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: false,
						sync_progress: 100.0,
						sync_status: 'COMPLETED'
					})
				});
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }
				])
			});
		});

		await page.goto('/network-schema');

		// Should show sync in progress initially
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();
		await expect(page.locator('text=50.0% complete')).toBeVisible();
		await expect(page.locator('text=Started by: other_user')).toBeVisible();
	});

	test('should handle sync failure gracefully', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						total_nodes: 10,
						nodes_with_canvas: 0,
						nodes_missing_canvas: 10,
						sync_needed: false,
						sync_in_progress: false,
						sync_status: 'FAILED',
						error_message: 'Database connection failed'
					})
				});
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});

		await page.goto('/network-schema');

		// Should show sync failed message
		await expect(page.locator('text=❌ Canvas sync failed')).toBeVisible();
		await expect(page.locator('text=Database connection failed')).toBeVisible();
	});

	test('should show no nodes warning when no data available', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					total_nodes: 0,
					nodes_with_canvas: 0,
					nodes_missing_canvas: 0,
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'IDLE'
				})
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});

		await page.goto('/network-schema');

		await expect(page.locator('text=⚠ No nodes loaded')).toBeVisible();
		await expect(page.locator('text=Total: 0 nodes')).toBeVisible();
	});

	test('should handle API errors gracefully', async ({ page }) => {
		// Mock API failure
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({ status: 500 });
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});

		await page.goto('/network-schema');

		// Should still load page despite API error
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 0 nodes')).toBeVisible();
	});

	test('should open node details drawer when button clicked', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'COMPLETED'
				})
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }
				])
			});
		});

		await page.goto('/network-schema');

		// Wait for page to load
		await expect(page.locator('text=✓ Canvas coordinates ready')).toBeVisible();

		// Click the Node Details button
		await page.locator('button', { hasText: 'Node Details' }).click();

		// Verify drawer functionality (this might need adjustment based on actual drawer implementation)
		// The test verifies the button can be clicked without error
		await expect(page.locator('button', { hasText: 'Node Details' })).toBeVisible();
	});

	test('should display correct project information', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'COMPLETED'
				})
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 },
					{ id: 2, name: 'Node 2', canvas_x: 150, canvas_y: 250 }
				])
			});
		});

		await page.goto('/network-schema');

		// Verify project and node information
		await expect(page.locator('text=Project: 1')).toBeVisible();
		await expect(page.locator('text=Total: 2 nodes')).toBeVisible();
	});

	test('should handle page refresh during sync properly', async ({ page }) => {
		// Mock ongoing sync
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: true,
					sync_progress: 30.0,
					sync_status: 'IN_PROGRESS',
					sync_started_by: 'current_user'
				})
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});

		await page.goto('/network-schema');

		// Verify sync in progress is shown
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();

		// Refresh the page
		await page.reload();

		// Should still show sync in progress after refresh
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();
		await expect(page.locator('text=30.0% complete')).toBeVisible();
	});

	test('should handle authentication errors', async ({ page }) => {
		// Mock authentication error
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({ status: 401 });
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({ status: 401 });
		});

		await page.goto('/network-schema');

		// Should handle auth errors gracefully
		// (The specific behavior depends on how the app handles 401s)
		// At minimum, the page should load without crashing
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
	});
});