import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (/** @type {number} */ status, /** @type {any} */ data) => ({ status, data })
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('pipe-branch +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		global.fetch = mockFetch;
		mockCookies = {
			get: vi.fn((/** @type {string} */ name) => {
				if (name === 'selected-project') return 'proj-1';
				if (name === 'api-access-token') return 'mock-token';
				return null;
			}),
			set: vi.fn()
		};
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	/**
	 * Creates a mock request event with form data.
	 * @param {Record<string, string>} formFields - Key-value pairs to populate the FormData
	 * @returns {any} Mock SvelteKit request event
	 */
	function createEvent(formFields = {}) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(formFields)) {
			formData.set(key, value);
		}
		return {
			request: { formData: () => Promise.resolve(formData) },
			fetch: mockFetch,
			cookies: mockCookies
		};
	}

	describe('load', () => {
		test('should return empty nodes when no project selected', async () => {
			mockCookies.get = vi.fn(() => null);

			const result = await load(
				/** @type {any} */ ({ fetch: mockFetch, params: {}, cookies: mockCookies })
			);

			expect(result).toEqual({ nodes: [], pipeBranchConfigured: false });
		});

		test('should parse minimal node response into node list', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						nodes: [
							{ name: 'Node A', uuid: 'uuid-a' },
							{ name: 'Node B', uuid: 'uuid-b' }
						],
						metadata: { pipe_branch_configured: true }
					})
			});

			const result = await load(
				/** @type {any} */ ({ fetch: mockFetch, params: {}, cookies: mockCookies })
			);

			expect(result).toEqual({
				nodes: [
					{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' },
					{ label: 'Node B', value: 'Node B', uuid: 'uuid-b' }
				],
				pipeBranchConfigured: true
			});

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/node/all/?project=proj-1&use_pipe_branch_settings=true&minimal=true',
				expect.objectContaining({ credentials: 'include' })
			);
		});

		test('should return empty nodes on non-ok response', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

			const result = await load(
				/** @type {any} */ ({ fetch: mockFetch, params: {}, cookies: mockCookies })
			);

			expect(result).toEqual({ nodes: [], pipeBranchConfigured: false });
		});

		test('should return empty nodes on invalid response structure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ invalid: 'data' })
			});

			const result = await load(
				/** @type {any} */ ({ fetch: mockFetch, params: {}, cookies: mockCookies })
			);

			expect(result).toEqual({ nodes: [], pipeBranchConfigured: false });
		});

		test('should return empty nodes on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await load(
				/** @type {any} */ ({ fetch: mockFetch, params: {}, cookies: mockCookies })
			);

			expect(result).toEqual({ nodes: [], pipeBranchConfigured: false });
		});

		test('should default pipeBranchConfigured to false when metadata missing', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						nodes: [{ name: 'N', uuid: 'u' }]
					})
			});

			const result = await load(
				/** @type {any} */ ({ fetch: mockFetch, params: {}, cookies: mockCookies })
			);

			expect(result.pipeBranchConfigured).toBe(false);
		});
	});

	describe('getConnections', () => {
		test('should fetch connections for a node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ uuid: 'conn-1' }])
			});

			const result = await actions.getConnections(createEvent({ node_id: 'node-1' }));

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/microduct_connection/all_connections/?uuid_node=node-1',
				expect.objectContaining({ method: 'GET' })
			);
			expect(result).toEqual({ type: 'success', data: [{ uuid: 'conn-1' }] });
		});

		test('should return fail(400) when node_id is missing', async () => {
			/** @type {any} */
			const result = await actions.getConnections(createEvent());

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('node_id');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Not found' }))
			});

			/** @type {any} */
			const result = await actions.getConnections(createEvent({ node_id: 'node-1' }));

			expect(result.status).toBe(404);
			expect(result.data.error).toBe('Not found');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.getConnections(createEvent({ node_id: 'node-1' }));

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('createConnection', () => {
		test('should create a connection with all required fields', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'new-conn-1' })
			});

			const result = await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/microduct_connection/',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({
						uuid_microduct_from_id: 'md-1',
						uuid_microduct_to_id: 'md-2',
						uuid_node_id: 'node-1',
						uuid_trench_from_id: 'trench-1',
						uuid_trench_to_id: 'trench-2'
					})
				})
			);
			expect(result).toEqual({ type: 'success', data: { uuid: 'new-conn-1' } });
		});

		test('should return fail(400) when required fields are missing', async () => {
			/** @type {any} */
			const result = await actions.createConnection(createEvent({ uuid_microduct_from: 'md-1' }));

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('Missing required fields');
		});

		test('should return fail(400) when connecting microduct to itself', async () => {
			/** @type {any} */
			const result = await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-1',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			);

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('Cannot connect a microduct to itself');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				text: () => Promise.resolve(JSON.stringify({ error: 'Validation error' }))
			});

			/** @type {any} */
			const result = await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			);

			expect(result.status).toBe(422);
			expect(result.data.error).toBe('Validation error');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			);

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('deleteConnection', () => {
		test('should delete a connection by UUID', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			const result = await actions.deleteConnection(createEvent({ uuid: 'conn-1' }));

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/microduct_connection/conn-1/',
				expect.objectContaining({ method: 'DELETE' })
			);
			expect(result).toEqual({ type: 'success', data: { success: true } });
		});

		test('should return fail(400) when uuid is missing', async () => {
			/** @type {any} */
			const result = await actions.deleteConnection(createEvent());

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('uuid');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Not found' }))
			});

			/** @type {any} */
			const result = await actions.deleteConnection(createEvent({ uuid: 'conn-1' }));

			expect(result.status).toBe(404);
			expect(result.data.error).toBe('Not found');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.deleteConnection(createEvent({ uuid: 'conn-1' }));

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('getTrenchesNearNode', () => {
		test('should fetch trenches near a node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ trenches: [{ uuid: 't-1' }] })
			});

			const result = await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A', project: 'proj-1' })
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/trenches-near-node/?node_name=Node%20A&project=proj-1',
				expect.objectContaining({ method: 'GET' })
			);
			expect(result).toEqual({
				type: 'success',
				data: { trenches: [{ uuid: 't-1' }] }
			});
		});

		test('should return fail(400) when node_name is missing', async () => {
			/** @type {any} */
			const result = await actions.getTrenchesNearNode(createEvent({ project: 'proj-1' }));

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('node_name');
		});

		test('should return fail(400) when project is missing', async () => {
			/** @type {any} */
			const result = await actions.getTrenchesNearNode(createEvent({ node_name: 'Node A' }));

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('project');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.resolve(JSON.stringify({ error: 'Server error' }))
			});

			/** @type {any} */
			const result = await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A', project: 'proj-1' })
			);

			expect(result.status).toBe(500);
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A', project: 'proj-1' })
			);

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('getTrenchSelections', () => {
		test('should fetch trench selections for a node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ trench: 't-1' }])
			});

			const result = await actions.getTrenchSelections(createEvent({ node_uuid: 'node-1' }));

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/node-trench-selection/by-node/node-1/',
				expect.objectContaining({ method: 'GET' })
			);
			expect(result).toEqual({ type: 'success', data: [{ trench: 't-1' }] });
		});

		test('should return fail(400) when node_uuid is missing', async () => {
			/** @type {any} */
			const result = await actions.getTrenchSelections(createEvent());

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('node_uuid');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.getTrenchSelections(createEvent({ node_uuid: 'node-1' }));

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('saveTrenchSelections', () => {
		test('should save trench selections for a node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ saved: true })
			});

			const result = await actions.saveTrenchSelections(
				createEvent({
					node_uuid: 'node-1',
					trench_uuids: JSON.stringify(['t-1', 't-2'])
				})
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/node-trench-selection/bulk-update/',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({
						node_uuid: 'node-1',
						trench_uuids: ['t-1', 't-2']
					})
				})
			);
			expect(result).toEqual({ type: 'success', data: { saved: true } });
		});

		test('should return fail(400) when node_uuid is missing', async () => {
			/** @type {any} */
			const result = await actions.saveTrenchSelections(createEvent());

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('node_uuid');
		});

		test('should handle empty trench_uuids', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ saved: true })
			});

			await actions.saveTrenchSelections(createEvent({ node_uuid: 'node-1' }));

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/node-trench-selection/bulk-update/',
				expect.objectContaining({
					body: JSON.stringify({ node_uuid: 'node-1', trench_uuids: [] })
				})
			);
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.saveTrenchSelections(
				createEvent({ node_uuid: 'node-1', trench_uuids: '["t-1"]' })
			);

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});
});
