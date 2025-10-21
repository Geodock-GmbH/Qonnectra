import { expect, test } from '@playwright/test';

test.describe('Multi-User Canvas Sync', () => {
	test('should handle concurrent users accessing sync', async ({ browser }) => {
		// Create two browser contexts to simulate different users
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		// Login both users
		await Promise.all([
			loginUser(page1, 'rainer_zufall'),
			loginUser(page2, 'rainer_zufall') // Using same user for simplicity
		]);

		let syncStarted = false;
		let conflictReturned = false;

		// Mock API responses for both pages
		await setupSyncMocks(page1, () => {
			if (!syncStarted) {
				syncStarted = true;
				return 'start_sync';
			}
			return 'sync_in_progress';
		});

		await setupSyncMocks(page2, () => {
			if (syncStarted && !conflictReturned) {
				conflictReturned = true;
				return 'conflict';
			}
			return 'sync_in_progress';
		});

		// Navigate both users to network-schema simultaneously
		await Promise.all([page1.goto('/network-schema'), page2.goto('/network-schema')]);

		// Wait for both pages to load
		await Promise.all([
			expect(page1.locator('[data-testid="svelte-flow"]')).toBeVisible(),
			expect(page2.locator('[data-testid="svelte-flow"]')).toBeVisible()
		]);

		// One user should see sync completed, the other should see sync in progress or completed
		const page1Status = await page1.locator('[data-testid="sync-status"]').textContent();
		const page2Status = await page2.locator('[data-testid="sync-status"]').textContent();

		// At least one should show successful completion
		expect(page1Status?.includes('✓') || page2Status?.includes('✓')).toBe(true);

		// Clean up
		await context1.close();
		await context2.close();
	});

	test('should show consistent results after concurrent sync', async ({ browser }) => {
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		await Promise.all([loginUser(page1, 'rainer_zufall'), loginUser(page2, 'rainer_zufall')]);

		// Set up mocks so first user triggers sync, second user waits
		let syncCompleted = false;
		const mockData = [
			{
				id: 1,
				name: 'Consistent Node 1',
				canvas_x: 100,
				canvas_y: 200,
				node_type: { node_type: 'Type A' },
				status: { status: 'Active' }
			},
			{
				id: 2,
				name: 'Consistent Node 2',
				canvas_x: 300,
				canvas_y: 400,
				node_type: { node_type: 'Type B' },
				status: { status: 'Active' }
			}
		];

		await setupConsistentSyncMocks(page1, mockData, () => syncCompleted);
		await setupConsistentSyncMocks(page2, mockData, () => syncCompleted);

		// User 1 navigates first (triggers sync)
		await page1.goto('/network-schema');

		// Wait a moment, then user 2 navigates
		await page1.waitForTimeout(500);
		await page2.goto('/network-schema');

		syncCompleted = true;

		// Both should eventually show the same data
		await Promise.all([
			expect(page1.locator('text=Total: 2 nodes')).toBeVisible(),
			expect(page2.locator('text=Total: 2 nodes')).toBeVisible()
		]);

		await Promise.all([
			expect(page1.locator('text=✓ Canvas coordinates ready')).toBeVisible(),
			expect(page2.locator('text=✓ Canvas coordinates ready')).toBeVisible()
		]);

		await context1.close();
		await context2.close();
	});

	test('should handle sync timeout gracefully', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		await loginUser(page, 'rainer_zufall');

		// Mock a sync that never completes (simulates timeout)
		let pollCount = 0;
		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			if (route.request().method() === 'GET') {
				pollCount++;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: true,
						sync_progress: Math.min(pollCount * 10, 90), // Progress that never reaches 100%
						sync_status: 'IN_PROGRESS',
						sync_started_by: 'stuck_user',
						total_nodes: 10
					})
				});
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Node 1', canvas_x: null, canvas_y: null }])
			});
		});

		await page.goto('/network-schema');

		// Should show sync in progress
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();

		// Wait for some polling attempts
		await page.waitForTimeout(3000);

		// Should still be showing sync in progress (haven't hit timeout yet in real scenario)
		await expect(page.locator('text=🔄 Canvas sync in progress')).toBeVisible();

		await context.close();
	});

	test('should handle network interruptions during sync', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		await loginUser(page, 'rainer_zufall');

		let requestCount = 0;

		await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
			requestCount++;

			if (requestCount === 1) {
				// First request succeeds - shows sync needed
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_needed: true,
						sync_in_progress: false,
						nodes_missing_canvas: 5,
						total_nodes: 5
					})
				});
			} else if (requestCount === 2) {
				// Network error during sync
				await route.abort('failed');
			} else {
				// Later requests succeed
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sync_in_progress: false,
						sync_status: 'COMPLETED',
						total_nodes: 5
					})
				});
			}
		});

		await page.route('**/canvas-coordinates/', async (route) => {
			if (route.request().method() === 'POST') {
				// Sync request fails
				await route.abort('failed');
			}
		});

		await page.route('**/node/all/?project=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([{ id: 1, name: 'Node 1', canvas_x: null, canvas_y: null }])
			});
		});

		await page.goto('/network-schema');

		// Should handle network errors gracefully and still show the page
		await expect(page.locator('[data-testid="svelte-flow"]')).toBeVisible();
		await expect(page.locator('text=Total: 1 nodes')).toBeVisible();

		await context.close();
	});

	test('should show different sync statuses to different users', async ({ browser }) => {
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		await Promise.all([loginUser(page1, 'rainer_zufall'), loginUser(page2, 'rainer_zufall')]);

		// User 1 sees they started the sync
		await page1.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_in_progress: true,
					sync_progress: 60.0,
					sync_status: 'IN_PROGRESS',
					sync_started_by: 'rainer_zufall', // Same as current user
					total_nodes: 10
				})
			});
		});

		// User 2 sees someone else started the sync
		await page2.route('**/canvas-coordinates/?project_id=1', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_in_progress: true,
					sync_progress: 60.0,
					sync_status: 'IN_PROGRESS',
					sync_started_by: 'other_user', // Different user
					total_nodes: 10
				})
			});
		});

		await Promise.all([
			page1.route('**/node/all/?project=1', (route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([])
				})
			),
			page2.route('**/node/all/?project=1', (route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([])
				})
			)
		]);

		await Promise.all([page1.goto('/network-schema'), page2.goto('/network-schema')]);

		// Both should show sync in progress
		await Promise.all([
			expect(page1.locator('text=🔄 Canvas sync in progress')).toBeVisible(),
			expect(page2.locator('text=🔄 Canvas sync in progress')).toBeVisible()
		]);

		// But with different attribution
		await expect(page1.locator('text=Started by: rainer_zufall')).toBeVisible();
		await expect(page2.locator('text=Started by: other_user')).toBeVisible();

		await context1.close();
		await context2.close();
	});
});

// Helper functions
async function loginUser(page, username) {
	await page.goto('/login');
	await page.locator('input[name="username"]').fill(username);
	await page.locator('input[name="password"]').fill('testuser');
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL('/map');
}

async function setupSyncMocks(page, syncStateProvider) {
	await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
		const state = syncStateProvider();

		if (state === 'start_sync') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: true,
					sync_in_progress: false,
					nodes_missing_canvas: 5,
					total_nodes: 5
				})
			});
		} else if (state === 'conflict') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: true,
					sync_progress: 25.0,
					sync_status: 'IN_PROGRESS',
					sync_started_by: 'other_user',
					total_nodes: 5
				})
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'COMPLETED',
					total_nodes: 5
				})
			});
		}
	});

	await page.route('**/canvas-coordinates/', async (route) => {
		if (route.request().method() === 'POST') {
			const state = syncStateProvider();
			if (state === 'conflict') {
				await route.fulfill({
					status: 409,
					contentType: 'application/json',
					body: JSON.stringify({
						message: 'Canvas coordinate sync already in progress',
						sync_started_by: 'other_user'
					})
				});
			} else {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						message: 'Successfully updated canvas coordinates',
						updated_count: 5
					})
				});
			}
		}
	});

	await page.route('**/node/all/?project=1', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }])
		});
	});
}

async function setupConsistentSyncMocks(page, mockData, isSyncCompleted) {
	await page.route('**/canvas-coordinates/?project_id=1', async (route) => {
		if (isSyncCompleted()) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'COMPLETED',
					total_nodes: mockData.length
				})
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sync_needed: true,
					sync_in_progress: true,
					sync_progress: 50.0,
					sync_status: 'IN_PROGRESS',
					total_nodes: mockData.length
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
					message: 'Successfully updated canvas coordinates',
					updated_count: mockData.length
				})
			});
		}
	});

	await page.route('**/node/all/?project=1', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(mockData)
		});
	});
}
