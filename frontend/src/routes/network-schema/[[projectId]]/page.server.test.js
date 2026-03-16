import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

// Mock the environment variable
vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

// Mock SvelteKit error/fail helpers
vi.mock('@sveltejs/kit', () => ({
	error: (/** @type {number} */ status, /** @type {string} */ message) => {
		const err = /** @type {any} */ (new Error(message));
		err.status = status;
		return err;
	},
	fail: (/** @type {number} */ status, /** @type {any} */ data) => {
		return { status, data };
	}
}));

describe('+page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Mock cookies
		mockCookies = {
			get: vi.fn((name) => {
				if (name === 'api-access-token') {
					return 'mock-token';
				}
				return null;
			})
		};

		// Mock fetch
		mockFetch = vi.fn();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	/**
	 * Helper function to create all the mock responses needed by the load function.
	 *
	 * The load function fetches data in this order:
	 * 1. Attribute data starts fetching in parallel (6 calls: cable_type, node_type, status, network_level, company, flags)
	 * 2. Sync status check (1 call)
	 * 3. If sync needed, sync POST (1 call)
	 * 4. If sync in progress, polling responses
	 * 5. Project data in parallel with awaiting attribute data (4 calls: node, cable, cable_label, cable_micropipe)
	 *
	 * Since Promise.all is used for attributes, the actual call order depends on timing.
	 * We use mockImplementation to handle this properly.
	 */
	function setupLoadMocks(
		/** @type {any} */ {
			syncStatus = { sync_needed: false, sync_in_progress: false },
			syncPostResponse = null,
			syncWaitPolls = [],
			nodes = [],
			cables = [],
			cableLabels = [],
			cableMicropipeConnections = {},
			cableTypes = [],
			nodeTypes = [],
			statuses = [],
			networkLevels = [],
			companies = [],
			flags = []
		} = {}
	) {
		// Create response generators for each endpoint
		const responses = {
			attributes_cable_type: { ok: true, json: () => Promise.resolve(cableTypes) },
			attributes_node_type: { ok: true, json: () => Promise.resolve(nodeTypes) },
			attributes_status: { ok: true, json: () => Promise.resolve(statuses) },
			attributes_network_level: { ok: true, json: () => Promise.resolve(networkLevels) },
			attributes_company: { ok: true, json: () => Promise.resolve(companies) },
			flags: { ok: true, json: () => Promise.resolve(flags) },
			'canvas-coordinates': { ok: true, json: () => Promise.resolve(syncStatus) },
			'node/all': { ok: true, json: () => Promise.resolve(nodes) },
			'cable/all': { ok: true, json: () => Promise.resolve(cables) },
			'cable_label/all': { ok: true, json: () => Promise.resolve(cableLabels) },
			'cables/micropipe-summary': {
				ok: true,
				json: () => Promise.resolve(cableMicropipeConnections)
			}
		};

		let syncPostCalled = false;
		let pollIndex = 0;

		mockFetch.mockImplementation((/** @type {any} */ url, /** @type {any} */ options) => {
			// Handle sync POST
			if (options?.method === 'POST' && url.includes('canvas-coordinates')) {
				syncPostCalled = true;
				return Promise.resolve(syncPostResponse || { ok: true, json: () => Promise.resolve({}) });
			}

			// Handle sync polling (subsequent GET to canvas-coordinates after initial)
			if (
				url.includes('canvas-coordinates') &&
				syncPostCalled &&
				pollIndex < syncWaitPolls.length
			) {
				return Promise.resolve(syncWaitPolls[pollIndex++]);
			}

			// Match URL to response
			for (const [key, response] of Object.entries(responses)) {
				if (url.includes(key)) {
					return Promise.resolve(response);
				}
			}

			// Default response
			return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
		});
	}

	describe('waitForSyncCompletion', () => {
		test('should wait for sync completion with polling', async () => {
			// First call: sync in progress (50%)
			// Second call: sync in progress (75%)
			// Third call: sync completed
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sync_in_progress: true,
							sync_progress: 50.0,
							sync_status: 'IN_PROGRESS'
						})
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sync_in_progress: true,
							sync_progress: 75.0,
							sync_status: 'IN_PROGRESS'
						})
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sync_in_progress: false,
							sync_progress: 100.0,
							sync_status: 'COMPLETED'
						})
				});

			// Mock setTimeout to resolve immediately for testing
			vi.spyOn(global, 'setTimeout').mockImplementation(
				/** @type {any} */ (
					(/** @type {Function} */ callback) => {
						callback();
						return 123;
					}
				)
			);

			const initialStatus = {
				sync_in_progress: true,
				sync_progress: 25.0
			};

			// Import the function after mocking
			const { _waitForSyncCompletion } = await import('./+page.server.js');

			const result = await _waitForSyncCompletion(
				mockFetch,
				new Headers(),
				initialStatus,
				30000, // 30 second timeout
				'1' // projectId
			);

			expect(result.sync_in_progress).toBe(false);
			expect(result.sync_status).toBe('COMPLETED');
			expect(mockFetch).toHaveBeenCalledTimes(3);

			// Restore setTimeout
			vi.restoreAllMocks();
		});

		test('should timeout after maxWaitTimeMs', async () => {
			// Always return in progress
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						sync_in_progress: true,
						sync_progress: 50.0,
						sync_status: 'IN_PROGRESS'
					})
			});

			// Mock Date.now to simulate time passing
			const originalDateNow = Date.now;
			let currentTime = 1000000;
			vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

			// Mock setTimeout to simulate time passing
			vi.spyOn(global, 'setTimeout').mockImplementation(
				/** @type {any} */ (
					(/** @type {Function} */ callback, /** @type {number} */ delay) => {
						currentTime += delay;
						callback();
						return 123;
					}
				)
			);

			const initialStatus = {
				sync_in_progress: true,
				sync_progress: 25.0
			};

			const { _waitForSyncCompletion } = await import('./+page.server.js');

			const result = await _waitForSyncCompletion(
				mockFetch,
				new Headers(),
				initialStatus,
				5000, // 5 second timeout for testing
				'1' // projectId
			);

			// Should timeout and return last status
			expect(result.sync_in_progress).toBe(true);
			expect(result.sync_status).toBe('IN_PROGRESS');

			// Restore mocks
			Date.now = originalDateNow;
			vi.restoreAllMocks();
		});

		test('should handle fetch errors during polling', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sync_in_progress: true,
							sync_progress: 50.0
						})
				})
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sync_in_progress: false,
							sync_status: 'COMPLETED'
						})
				});

			vi.spyOn(global, 'setTimeout').mockImplementation(
				/** @type {any} */ (
					(/** @type {Function} */ callback) => {
						callback();
						return 123;
					}
				)
			);

			const initialStatus = {
				sync_in_progress: true,
				sync_progress: 25.0
			};

			const { _waitForSyncCompletion } = await import('./+page.server.js');

			const result = await _waitForSyncCompletion(
				mockFetch,
				new Headers(),
				initialStatus,
				30000,
				'1'
			);

			// Should handle error gracefully and continue polling
			expect(mockFetch).toHaveBeenCalledTimes(2); // Error stops polling

			vi.restoreAllMocks();
		});

		test('should handle HTTP errors during polling', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500
			});

			vi.spyOn(global, 'setTimeout').mockImplementation(
				/** @type {any} */ (
					(/** @type {Function} */ callback) => {
						callback();
						return 123;
					}
				)
			);

			const initialStatus = {
				sync_in_progress: true,
				sync_progress: 25.0
			};

			const { _waitForSyncCompletion } = await import('./+page.server.js');

			const result = await _waitForSyncCompletion(
				mockFetch,
				new Headers(),
				initialStatus,
				30000,
				'1'
			);

			// Should return initial status when polling fails
			expect(result).toEqual(initialStatus);

			vi.restoreAllMocks();
		});
	});

	describe('load function', () => {
		test('should handle sync not needed scenario', async () => {
			setupLoadMocks({
				syncStatus: {
					sync_needed: false,
					sync_in_progress: false,
					sync_status: 'IDLE',
					total_nodes: 10,
					nodes_with_canvas: 10,
					nodes_missing_canvas: 0
				},
				nodes: [{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }]
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			expect(result.nodes).toHaveLength(1);
			expect(result.syncStatus).toBeDefined();
			expect(result.syncStatus.sync_needed).toBe(false);
		});

		test('should handle sync needed and start new sync', async () => {
			setupLoadMocks({
				syncStatus: {
					sync_needed: true,
					sync_in_progress: false,
					nodes_missing_canvas: 5
				},
				syncPostResponse: {
					ok: true,
					json: () =>
						Promise.resolve({
							message: 'Successfully synced',
							updated_count: 5
						})
				},
				nodes: [{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }]
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			expect(result.nodes).toHaveLength(1);

			// Find the POST call to canvas-coordinates
			const postCall = mockFetch.mock.calls.find(
				(/** @type {any} */ call) =>
					call[1]?.method === 'POST' && call[0].includes('canvas-coordinates')
			);
			expect(postCall).toBeDefined();
			expect(JSON.parse(postCall[1].body)).toEqual({
				project_id: '1',
				scale: 0.5
			});
		});

		test('should handle sync in progress and wait for completion', async () => {
			// Mock setTimeout for waitForSyncCompletion
			vi.spyOn(global, 'setTimeout').mockImplementation(
				/** @type {any} */ (
					(/** @type {Function} */ callback) => {
						callback();
						return 123;
					}
				)
			);

			// Track call count for canvas-coordinates to differentiate initial check vs polling
			let canvasCoordinatesCallCount = 0;

			mockFetch.mockImplementation((/** @type {any} */ url, /** @type {any} */ options) => {
				if (url.includes('canvas-coordinates')) {
					canvasCoordinatesCallCount++;
					// First call: initial sync status check - returns in progress
					if (canvasCoordinatesCallCount === 1) {
						return Promise.resolve({
							ok: true,
							json: () =>
								Promise.resolve({
									sync_needed: false,
									sync_in_progress: true,
									sync_progress: 75.0,
									sync_status: 'IN_PROGRESS'
								})
						});
					}
					// Second call (polling): sync completed
					return Promise.resolve({
						ok: true,
						json: () =>
							Promise.resolve({
								sync_in_progress: false,
								sync_progress: 100.0,
								sync_status: 'COMPLETED'
							})
					});
				}
				if (url.includes('node/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }])
					});
				}
				// Default for other endpoints
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			expect(result.nodes).toHaveLength(1);
			expect(result.syncStatus.sync_status).toBe('COMPLETED');

			vi.restoreAllMocks();
		});

		test('should handle 409 conflict during sync start', async () => {
			setupLoadMocks({
				syncStatus: {
					sync_needed: true,
					sync_in_progress: false,
					nodes_missing_canvas: 5
				},
				syncPostResponse: {
					ok: false,
					status: 409,
					json: () =>
						Promise.resolve({
							message: 'Canvas coordinate sync already in progress',
							sync_started_by: 'other_user'
						})
				},
				nodes: [{ id: 1, name: 'Node 1' }]
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			expect(result.nodes).toHaveLength(1);
			// Should not fail despite the conflict
		});

		test('should handle sync status check failure', async () => {
			// Use mockImplementation to handle the parallel fetches properly
			mockFetch.mockImplementation((/** @type {any} */ url) => {
				if (url.includes('canvas-coordinates')) {
					// Sync status check fails
					return Promise.resolve({ ok: false, status: 500 });
				}
				if (url.includes('node/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 1, name: 'Node 1' }])
					});
				}
				// Default for other endpoints
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			expect(result.nodes).toHaveLength(1);
			expect(result.syncStatus).toBeNull();
		});

		test('should handle node fetch failure', async () => {
			// Override setupLoadMocks to fail node fetch
			mockFetch.mockImplementation((/** @type {any} */ url) => {
				if (url.includes('node/all')) {
					return Promise.resolve({ ok: false, status: 500 });
				}
				if (url.includes('canvas-coordinates')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve({ sync_needed: false, sync_in_progress: false })
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			// The implementation throws error(500, 'Failed to fetch nodes') which gets caught
			// and re-thrown, so we expect it to reject
			await expect(
				load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			).rejects.toThrow();
		});

		test('should handle complete failure gracefully', async () => {
			// Mock sync status fetch to fail, which will cause the load to fail early
			// The parallel attribute fetches will resolve to avoid unhandled rejection
			mockFetch.mockImplementation((/** @type {any} */ url) => {
				if (url.includes('canvas-coordinates')) {
					// This is awaited first and will cause early exit
					return Promise.reject(new Error('Complete network failure'));
				}
				// Other parallel fetches resolve normally
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			// The load function catches errors and returns empty data
			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			expect(result.nodes).toEqual([]);
			expect(result.cables).toEqual([]);
			expect(result.syncStatus).toBeNull();
		});

		test('should pass correct auth headers', async () => {
			setupLoadMocks();

			await load(
				/** @type {any} */ ({
					fetch: mockFetch,
					cookies: mockCookies,
					url: new URL('http://localhost'),
					params: { projectId: '1' }
				})
			);

			// Check that auth headers were passed correctly
			// getAuthHeaders returns a plain object { Cookie: '...' }, not a Headers instance
			const firstCall = mockFetch.mock.calls[0];
			const headers = firstCall[1].headers;

			expect(headers.Cookie).toBe('api-access-token=mock-token');
			expect(firstCall[1].credentials).toBe('include');
		});

		test('should handle missing auth token', async () => {
			mockCookies.get.mockReturnValue(null);

			setupLoadMocks();

			await load(
				/** @type {any} */ ({
					fetch: mockFetch,
					cookies: mockCookies,
					url: new URL('http://localhost'),
					params: { projectId: '1' }
				})
			);

			// Should still make requests but without auth header
			// getAuthHeaders returns {} when no token, so Cookie will be undefined
			const firstCall = mockFetch.mock.calls[0];
			const headers = firstCall[1].headers;

			expect(headers.Cookie).toBeUndefined();
		});

		test('should handle sync POST failure', async () => {
			setupLoadMocks({
				syncStatus: {
					sync_needed: true,
					sync_in_progress: false,
					nodes_missing_canvas: 5
				},
				syncPostResponse: {
					ok: false,
					status: 500
				}
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: { projectId: '1' }
					})
				)
			);

			// Should continue and fetch nodes despite sync failure
			expect(result.nodes).toEqual([]);
		});

		test('should handle different project and flag parameters', async () => {
			// This test verifies that the dynamic projectId parameter is used correctly
			setupLoadMocks();

			await load(
				/** @type {any} */ ({
					fetch: mockFetch,
					cookies: mockCookies,
					url: new URL('http://localhost'),
					params: { projectId: '1' }
				})
			);

			// Find the sync status check call
			const syncStatusCall = mockFetch.mock.calls.find((/** @type {any} */ call) =>
				call[0].includes('canvas-coordinates')
			);
			expect(syncStatusCall[0]).toContain('project_id=1');

			// Find the node fetch call
			const nodeCall = mockFetch.mock.calls.find((/** @type {any} */ call) =>
				call[0].includes('node/all')
			);
			expect(nodeCall[0]).toContain('project=1');
		});

		test('should return empty nodes and null syncStatus when projectId is missing', async () => {
			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						url: new URL('http://localhost'),
						params: {}
					})
				)
			);

			expect(result.nodes).toEqual([]);
			expect(result.syncStatus).toBeNull();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('saveNodeGeometry action', () => {
		test('should successfully save node geometry', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'test-node-123',
						name: 'Test Node',
						canvas_x: 150.5,
						canvas_y: 200.3
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(result.message).toBe('Node position saved successfully');
			expect(result.node.uuid).toBe('test-node-123');
			expect(result.node.canvas_x).toBe(150.5);
			expect(result.node.canvas_y).toBe(200.3);

			// Verify the API call
			const patchCall = mockFetch.mock.calls[0];
			expect(patchCall[0]).toBe('http://localhost:8000/node/test-node-123/');
			expect(patchCall[1].method).toBe('PATCH');
			expect(patchCall[1].credentials).toBe('include');
			expect(JSON.parse(patchCall[1].body)).toEqual({
				canvas_x: 150.5,
				canvas_y: 200.3
			});
		});

		test('should return error when nodeId is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Node ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should successfully save child canvas coordinates', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'test-node-123',
						child_canvas_x: 150.5,
						child_canvas_y: 200.3
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['child_canvas_x', '150.5'],
							['child_canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(result.message).toBe('Node position saved successfully');
			expect(result.node.child_canvas_x).toBe(150.5);
			expect(result.node.child_canvas_y).toBe(200.3);

			// Verify the API call
			const patchCall = mockFetch.mock.calls[0];
			expect(patchCall[0]).toBe('http://localhost:8000/node/test-node-123/');
			expect(patchCall[1].method).toBe('PATCH');
			expect(JSON.parse(patchCall[1].body)).toEqual({
				child_canvas_x: 150.5,
				child_canvas_y: 200.3
			});
		});

		test('should return error when child canvas coordinates are invalid', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['child_canvas_x', 'invalid'],
							['child_canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Invalid child canvas coordinates');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should return error when canvas coordinates are invalid', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', 'invalid'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Invalid canvas coordinates');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should return error when canvas_y is invalid', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', 'not-a-number']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Invalid canvas coordinates');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error response with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () =>
					Promise.resolve({
						detail: 'Node not found'
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'nonexistent-node'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Node not found');
		});

		test('should handle API error response without detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.resolve({})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('HTTP 500: Failed to update node position');
		});

		test('should handle API response with invalid JSON', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error('Invalid JSON'))
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('HTTP 500: Failed to update node position');
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Network connection failed');
		});

		test('should handle generic errors without message', async () => {
			mockFetch.mockRejectedValueOnce({});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Failed to save node position');
		});

		test('should pass correct request options', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'test-node-123',
						canvas_x: 150.5,
						canvas_y: 200.3
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '150.5'],
							['canvas_y', '200.3']
						])
					)
			};

			await actions.saveNodeGeometry(
				/** @type {any} */ ({
					request: mockRequest,
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			const patchCall = mockFetch.mock.calls[0];

			expect(patchCall[0]).toBe('http://localhost:8000/node/test-node-123/');
			expect(patchCall[1].method).toBe('PATCH');
			expect(patchCall[1].credentials).toBe('include');
			expect(patchCall[1].headers['Content-Type']).toBe('application/json');
			expect(JSON.parse(patchCall[1].body)).toEqual({
				canvas_x: 150.5,
				canvas_y: 200.3
			});
		});

		test('should handle zero coordinates correctly', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'test-node-123',
						canvas_x: 0,
						canvas_y: 0
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '0'],
							['canvas_y', '0']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
				canvas_x: 0,
				canvas_y: 0
			});
		});

		test('should handle negative coordinates correctly', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'test-node-123',
						canvas_x: -50.5,
						canvas_y: -100.3
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['nodeId', 'test-node-123'],
							['canvas_x', '-50.5'],
							['canvas_y', '-100.3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveNodeGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
				canvas_x: -50.5,
				canvas_y: -100.3
			});
		});
	});

	describe('getAuthHeaders', () => {
		test('should create headers with auth token', async () => {
			const { getAuthHeaders } = await import('$lib/utils/getAuthHeaders');

			const headers = getAuthHeaders(mockCookies);

			// getAuthHeaders returns a plain object, not a Headers instance
			expect(headers.Cookie).toBe('api-access-token=mock-token');
		});

		test('should create headers without auth token when missing', async () => {
			mockCookies.get.mockReturnValue(null);

			const { getAuthHeaders } = await import('$lib/utils/getAuthHeaders');

			const headers = getAuthHeaders(mockCookies);

			// When no token, getAuthHeaders returns an empty object
			expect(headers.Cookie).toBeUndefined();
		});
	});

	describe('saveCableGeometry action', () => {
		test('should successfully save cable geometry', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'cable-123',
						diagram_path: [
							{ x: 10, y: 20 },
							{ x: 30, y: 40 }
						]
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['cableId', 'cable-123'],
							[
								'diagram_path',
								JSON.stringify([
									{ x: 10, y: 20 },
									{ x: 30, y: 40 }
								])
							]
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveCableGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(result.message).toBe('Cable path saved successfully');
			expect(result.cable.uuid).toBe('cable-123');

			const patchCall = mockFetch.mock.calls[0];
			expect(patchCall[0]).toBe('http://localhost:8000/cable/cable-123/');
			expect(patchCall[1].method).toBe('PATCH');
			expect(JSON.parse(patchCall[1].body)).toEqual({
				diagram_path: [
					{ x: 10, y: 20 },
					{ x: 30, y: 40 }
				]
			});
		});

		test('should return error when cableId is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(new Map([['diagram_path', JSON.stringify([{ x: 10, y: 20 }])]]))
			};

			const result = /** @type {any} */ (
				await actions.saveCableGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Cable ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should return error for invalid diagram_path JSON', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['cableId', 'cable-123'],
							['diagram_path', 'not-valid-json']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveCableGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Invalid diagram path format');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should send null diagram_path when not provided', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'cable-123',
						diagram_path: null
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['cableId', 'cable-123']]))
			};

			const result = /** @type {any} */ (
				await actions.saveCableGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
				diagram_path: null
			});
		});

		test('should handle API error response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid cable path' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['cableId', 'cable-123'],
							['diagram_path', JSON.stringify([{ x: 10, y: 20 }])]
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveCableGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Invalid cable path');
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['cableId', 'cable-123'],
							['diagram_path', JSON.stringify([{ x: 10, y: 20 }])]
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.saveCableGeometry(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Network error');
		});
	});

	describe('createCable action', () => {
		/**
		 * createCable uses global fetch (not from event), so we mock it on globalThis.
		 * @type {any}
		 */
		let originalFetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
			globalThis.fetch = mockFetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		test('should successfully create a cable', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'new-cable-uuid',
						name: 'Test Cable'
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['name', 'Test Cable'],
							['cable_type_id', '1'],
							['project_id', '5'],
							['flag_id', '2'],
							['uuid_node_start_id', 'node-start-uuid'],
							['uuid_node_end_id', 'node-end-uuid']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.createCable(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(result.data.uuid).toBe('new-cable-uuid');

			const postCall = mockFetch.mock.calls[0];
			expect(postCall[1].method).toBe('POST');
			const body = JSON.parse(postCall[1].body);
			expect(body.name).toBe('Test Cable');
			expect(body.cable_type_id).toBe(1);
			expect(body.project_id).toBe(5);
			expect(body.flag_id).toBe(2);
			expect(body.uuid_node_start_id).toBe('node-start-uuid');
			expect(body.uuid_node_end_id).toBe('node-end-uuid');
		});

		test('should return 400 when required fields are missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['name', 'Test Cable'],
							['uuid_node_start_id', 'node-start'],
							['uuid_node_end_id', 'node-end']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.createCable(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('Missing required fields');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should return 400 when node IDs are missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['name', 'Test Cable'],
							['cable_type_id', '1'],
							['project_id', '5'],
							['flag_id', '2']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.createCable(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('uuid_node_start_id');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				text: () => Promise.resolve(JSON.stringify({ error: 'Validation failed' }))
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['name', 'Test Cable'],
							['cable_type_id', '1'],
							['project_id', '5'],
							['flag_id', '2'],
							['uuid_node_start_id', 'node-start'],
							['uuid_node_end_id', 'node-end']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.createCable(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(422);
		});

		test('should include optional fields when provided', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'custom-uuid', name: 'Test Cable' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'custom-uuid'],
							['name', 'Test Cable'],
							['cable_type_id', '1'],
							['project_id', '5'],
							['flag_id', '2'],
							['uuid_node_start_id', 'node-start'],
							['uuid_node_end_id', 'node-end'],
							['handle_start', 'top'],
							['handle_end', 'bottom'],
							['parent_node_context_id', 'parent-node-uuid']
						])
					)
			};

			await actions.createCable(
				/** @type {any} */ ({
					request: mockRequest,
					cookies: mockCookies
				})
			);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.uuid).toBe('custom-uuid');
			expect(body.handle_start).toBe('top');
			expect(body.handle_end).toBe('bottom');
			expect(body.parent_node_context_id).toBe('parent-node-uuid');
		});
	});

	describe('getCables action', () => {
		/**
		 * getCables uses global fetch (not from event), so we mock it on globalThis.
		 * @type {any}
		 */
		let originalFetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
			globalThis.fetch = mockFetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		test('should successfully fetch a cable by uuid', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'cable-123', name: 'Cable A' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'cable-123']]))
			};

			const result = /** @type {any} */ (
				await actions.getCables(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.uuid).toBe('cable-123');
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/cable/cable-123');
		});

		test('should return 400 when uuid is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map())
			};

			const result = /** @type {any} */ (
				await actions.getCables(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('uuid is required');
		});

		test('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Cable not found' }))
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'nonexistent']]))
			};

			const result = /** @type {any} */ (
				await actions.getCables(
					/** @type {any} */ ({
						request: mockRequest,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(404);
		});
	});

	describe('updateCable action', () => {
		test('should successfully update a cable', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'cable-123',
						name: 'Updated Cable',
						cable_type_id: 2
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'cable-123'],
							['cable_name', 'Updated Cable'],
							['cable_type_id', '2'],
							['status_id', '3']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.updateCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Cable updated successfully');
			expect(result.cable.uuid).toBe('cable-123');

			const patchCall = mockFetch.mock.calls[0];
			expect(patchCall[0]).toBe('http://localhost:8000/cable/cable-123/');
			expect(patchCall[1].method).toBe('PATCH');
			const body = JSON.parse(patchCall[1].body);
			expect(body.name).toBe('Updated Cable');
			expect(body.cable_type_id).toBe(2);
			expect(body.status_id).toBe(3);
		});

		test('should return error when cable ID is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['cable_name', 'Updated Cable']]))
			};

			const result = /** @type {any} */ (
				await actions.updateCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Cable ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid cable type' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'cable-123'],
							['cable_type_id', '999']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.updateCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid cable type');
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'cable-123'],
							['cable_name', 'Test']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.updateCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection refused');
		});
	});

	describe('deleteCable action', () => {
		test('should successfully delete a cable', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'cable-123']]))
			};

			const result = /** @type {any} */ (
				await actions.deleteCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Cable deleted successfully');

			const deleteCall = mockFetch.mock.calls[0];
			expect(deleteCall[0]).toBe('http://localhost:8000/cable/cable-123/');
			expect(deleteCall[1].method).toBe('DELETE');
		});

		test('should return 400 when cable ID is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map())
			};

			const result = /** @type {any} */ (
				await actions.deleteCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Cable ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 409,
				json: () => Promise.resolve({ detail: 'Cable has dependent fibers' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'cable-123']]))
			};

			const result = /** @type {any} */ (
				await actions.deleteCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(409);
			expect(result.data.message).toBe('Cable has dependent fibers');
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'cable-123']]))
			};

			const result = /** @type {any} */ (
				await actions.deleteCable(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network timeout');
		});
	});

	describe('getNodes action', () => {
		test('should successfully fetch a node by uuid', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'node-123',
						name: 'Node A',
						node_type: { node_type: 'Type A' }
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'node-123']]))
			};

			const result = /** @type {any} */ (
				await actions.getNodes(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.uuid).toBe('node-123');
			expect(result.name).toBe('Node A');
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/node/node-123');
		});

		test('should return 400 when uuid is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map())
			};

			const result = /** @type {any} */ (
				await actions.getNodes(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('uuid is required');
		});

		test('should handle API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Node not found' }))
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'nonexistent']]))
			};

			const result = /** @type {any} */ (
				await actions.getNodes(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(404);
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'node-123']]))
			};

			const result = /** @type {any} */ (
				await actions.getNodes(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('updateNode action', () => {
		test('should successfully update a node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						uuid: 'node-123',
						name: 'Updated Node',
						node_type_id: 2
					})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'node-123'],
							['node_name', 'Updated Node'],
							['node_type_id', '2'],
							['status_id', '3'],
							['network_level_id', '1']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.updateNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Node updated successfully');
			expect(result.node.uuid).toBe('node-123');

			const patchCall = mockFetch.mock.calls[0];
			expect(patchCall[0]).toBe('http://localhost:8000/node/node-123/');
			expect(patchCall[1].method).toBe('PATCH');
			const body = JSON.parse(patchCall[1].body);
			expect(body.name).toBe('Updated Node');
			expect(body.node_type_id).toBe(2);
			expect(body.status_id).toBe(3);
		});

		test('should return error when node ID is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['node_name', 'Updated Node']]))
			};

			const result = /** @type {any} */ (
				await actions.updateNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Node ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should set parent_node_id to null when not provided', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'node-123', name: 'Node' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'node-123'],
							['node_name', 'Node']
						])
					)
			};

			await actions.updateNode(
				/** @type {any} */ ({
					request: mockRequest,
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.parent_node_id).toBeNull();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid node type' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'node-123'],
							['node_type_id', '999']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.updateNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid node type');
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () =>
					Promise.resolve(
						new Map([
							['uuid', 'node-123'],
							['node_name', 'Test']
						])
					)
			};

			const result = /** @type {any} */ (
				await actions.updateNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection failed');
		});
	});

	describe('deleteNode action', () => {
		test('should successfully delete a node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'node-123']]))
			};

			const result = /** @type {any} */ (
				await actions.deleteNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('success');
			expect(result.message).toBe('Node deleted successfully');

			const deleteCall = mockFetch.mock.calls[0];
			expect(deleteCall[0]).toBe('http://localhost:8000/node/node-123/');
			expect(deleteCall[1].method).toBe('DELETE');
		});

		test('should return error when node ID is missing', async () => {
			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map())
			};

			const result = /** @type {any} */ (
				await actions.deleteNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.type).toBe('error');
			expect(result.message).toBe('Node ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 409,
				json: () => Promise.resolve({ detail: 'Node has dependent cables' })
			});

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'node-123']]))
			};

			const result = /** @type {any} */ (
				await actions.deleteNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(409);
			expect(result.data.message).toBe('Node has dependent cables');
		});

		test('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Server unreachable'));

			const { actions } = await import('./+page.server.js');

			const mockRequest = {
				formData: () => Promise.resolve(new Map([['uuid', 'node-123']]))
			};

			const result = /** @type {any} */ (
				await actions.deleteNode(
					/** @type {any} */ ({
						request: mockRequest,
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Server unreachable');
		});
	});
});
