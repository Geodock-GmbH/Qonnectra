import { test, expect } from '@playwright/test';

test.describe('Canvas Sync Edge Cases', () => {
	test.beforeEach(async ({ page }) => {
		// Login before each test
		await page.goto('/login');
		await page.locator('input[name="username"]').fill('rainer_zufall');
		await page.locator('input[name="password"]').fill('testuser');
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL('/map');
	});

	test('should handle sync timeout after 30 seconds', async ({ page }) => {
		// Mock a sync that takes too long
		let startTime = Date.now();

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			const elapsed = Date.now() - startTime;

			if (elapsed < 31000) {
				// Less than 31 seconds
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: true,
						sync_progress: Math.min((elapsed / 1000) * 3, 95), // Slow progress
						sync_status: 'IN_PROGRESS',
						sync_started_by: 'slow_user',
						total_nodes: 100
					})
				});
			} else {
				// After timeout, should still be in progress
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: true,
						sync_progress: 95.0,
						sync_status: 'IN_PROGRESS',
						sync_started_by: 'slow_user',
						total_nodes: 100
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

		// Set page timeout higher than our sync timeout
		page.setDefaultTimeout(35000);

		await page.goto('/network-schema');

		// Should show sync in progress
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();

		// Wait for timeout period (this is testing the timeout logic in waitForSyncCompletion)
		await page.waitForTimeout(32000);

		// Page should still be functional after timeout
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
	});

	test('should recover from stale sync automatically', async ({ page }) => {
		let requestCount = 0;

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			requestCount++;

			if (requestCount === 1) {
				// First request shows stale sync
				const staleTime = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: true,
						sync_progress: 50.0,
						sync_status: 'IN_PROGRESS',
						sync_started_by: 'stale_user',
						sync_started_at: staleTime,
						total_nodes: 10
					})
				});
			} else {
				// Subsequent requests show sync completed (cleanup happened)
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: false,
						sync_status: 'COMPLETED',
						total_nodes: 10,
						nodes_with_canvas: 10,
						nodes_missing_canvas: 0,
						sync_needed: false
					})
				});
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }])
			});
		});

		await page.goto('/network-schema');

		// Should eventually show completed state after stale cleanup
		await expect(page.locator('text=✓ Canvas coordinates ready')).toBeVisible({ timeout: 10000 });
	});

	test('should handle rapid page refreshes during sync', async ({ page }) => {
		let refreshCount = 0;

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			refreshCount++;

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_in_progress: true,
					sync_progress: Math.min(refreshCount * 20, 80),
					sync_status: 'IN_PROGRESS',
					sync_started_by: 'persistent_user',
					total_nodes: 10
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

		// Verify sync in progress
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();

		// Rapid refreshes
		for (let i = 0; i < 3; i++) {
			await page.reload();
			await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();
			await page.waitForTimeout(500);
		}

		// Should still be functional after multiple refreshes
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
	});

	test('should handle mixed response types gracefully', async ({ page }) => {
		let requestCount = 0;

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			requestCount++;

			// Alternate between different response formats
			if (requestCount % 3 === 1) {
				// Sometimes return minimal response
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_needed: false,
						sync_in_progress: false
					})
				});
			} else if (requestCount % 3 === 2) {
				// Sometimes return full response
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						total_nodes: 5,
						nodes_with_canvas: 5,
						nodes_missing_canvas: 0,
						sync_needed: false,
						sync_in_progress: false,
						sync_status: 'COMPLETED',
						sync_progress: 100.0
					})
				});
			} else {
				// Sometimes return error
				await route.fulfill({ status: 500 });
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Robust Node', canvas_x: 100, canvas_y: 200 }])
			});
		});

		await page.goto('/network-schema');

		// Should handle mixed responses gracefully
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();
	});

	test('should handle very large progress values', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_in_progress: true,
					sync_progress: 150.7, // Invalid progress > 100
					sync_status: 'IN_PROGRESS',
					total_nodes: 10
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

		// Should handle invalid progress gracefully (might show as 150.7% or be capped)
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();
		await expect(page.locator(/\d+\.\d% complete/)).toBeVisible();
	});

	test('should handle negative progress values', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_in_progress: true,
					sync_progress: -25.5, // Invalid negative progress
					sync_status: 'IN_PROGRESS',
					total_nodes: 10
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

		// Should handle negative progress gracefully
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();
	});

	test('should handle malformed JSON responses', async ({ page }) => {
		let requestCount = 0;

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			requestCount++;

			if (requestCount === 1) {
				// Return malformed JSON
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '{"sync_needed": true, "incomplete": '
				});
			} else {
				// Recovery with valid JSON
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_needed: false,
						sync_in_progress: false,
						sync_status: 'COMPLETED'
					})
				});
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Recovery Node', canvas_x: 100, canvas_y: 200 }])
			});
		});

		await page.goto('/network-schema');

		// Should handle JSON parsing errors gracefully
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();
	});

	test('should handle extremely slow API responses', async ({ page }) => {
		// Set longer timeout for this test
		page.setDefaultTimeout(20000);

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			// Simulate slow API response
			await new Promise((resolve) => setTimeout(resolve, 5000));

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'COMPLETED',
					total_nodes: 1
				})
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Slow Node', canvas_x: 100, canvas_y: 200 }])
			});
		});

		const startTime = Date.now();
		await page.goto('/network-schema');

		// Should eventually load despite slow API
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();

		const elapsed = Date.now() - startTime;
		expect(elapsed).toBeGreaterThan(4000); // Verify it actually waited
	});

	test('should handle concurrent API calls with race conditions', async ({ page }) => {
		let callCount = 0;
		let responses = [];

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			callCount++;
			const currentCall = callCount;

			// Simulate race condition - later calls might complete first
			const delay = currentCall === 1 ? 2000 : 100;
			await new Promise((resolve) => setTimeout(resolve, delay));

			const response = {
				sync_needed: currentCall === 1,
				sync_in_progress: currentCall === 1,
				sync_status: currentCall === 1 ? 'IN_PROGRESS' : 'COMPLETED',
				total_nodes: 5,
				call_order: currentCall
			};

			responses.push(response);

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(response)
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Race Node', canvas_x: 100, canvas_y: 200 }])
			});
		});

		await page.goto('/network-schema');

		// Should handle race conditions gracefully
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();
	});

	test('should handle missing required API fields', async ({ page }) => {
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					// Missing required fields like sync_needed, sync_in_progress
					some_other_field: 'value',
					total_nodes: 3
				})
			});
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{ id: 1, name: 'Minimal Node' } // Missing canvas coordinates
				])
			});
		});

		await page.goto('/network-schema');

		// Should handle missing fields gracefully
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();
	});
});
