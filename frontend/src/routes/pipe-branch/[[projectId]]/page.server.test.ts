import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: Record<string, unknown>) => ({ status, data })
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('pipe-branch +page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: Record<string, unknown>;
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		global.fetch = mockFetch;
		mockCookies = {
			get: vi.fn((name: string) => {
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
	 */
	function createEvent(formFields: Record<string, string> = {}): Record<string, unknown> {
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

			const result = await load({ fetch: mockFetch, params: {}, cookies: mockCookies } as Record<
				string,
				unknown
			>);

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

			const result = await load({ fetch: mockFetch, params: {}, cookies: mockCookies } as Record<
				string,
				unknown
			>);

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

			const result = await load({ fetch: mockFetch, params: {}, cookies: mockCookies } as Record<
				string,
				unknown
			>);

			expect(result).toEqual({ nodes: [], pipeBranchConfigured: false });
		});

		test('should return empty nodes on invalid response structure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ invalid: 'data' })
			});

			const result = await load({ fetch: mockFetch, params: {}, cookies: mockCookies } as Record<
				string,
				unknown
			>);

			expect(result).toEqual({ nodes: [], pipeBranchConfigured: false });
		});

		test('should return empty nodes on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await load({ fetch: mockFetch, params: {}, cookies: mockCookies } as Record<
				string,
				unknown
			>);

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

			const result = await load({ fetch: mockFetch, params: {}, cookies: mockCookies } as Record<
				string,
				unknown
			>);

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
			const result = (await actions.getConnections(createEvent())) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('node_id');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Not found' }))
			});

			const result = (await actions.getConnections(createEvent({ node_id: 'node-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(404);
			expect((result.data as Record<string, unknown>).error).toBe('Not found');
		});

		test('should fall back to status message when error body is empty', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				text: () => Promise.resolve('')
			});

			const result = (await actions.getConnections(createEvent({ node_id: 'node-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(503);
			expect((result.data as Record<string, unknown>).error).toBe(
				'Request failed with status: 503'
			);
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.getConnections(createEvent({ node_id: 'node-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal server error');
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
			const result = (await actions.createConnection(
				createEvent({ uuid_microduct_from: 'md-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('Missing required fields');
		});

		test('should return fail(400) when connecting microduct to itself', async () => {
			const result = (await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-1',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain(
				'Cannot connect a microduct to itself'
			);
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				text: () => Promise.resolve(JSON.stringify({ error: 'Validation error' }))
			});

			const result = (await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			)) as Record<string, unknown>;

			expect(result.status).toBe(422);
			expect((result.data as Record<string, unknown>).error).toBe('Validation error');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal server error');
		});

		test('should omit Cookie header when api-access-token is absent', async () => {
			mockCookies.get = vi.fn(() => null);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'new-conn-1' })
			});

			await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			);

			const headers = mockFetch.mock.calls[0][1].headers as Headers;
			expect(headers.get('Cookie')).toBeNull();
			expect(headers.get('Content-Type')).toBe('application/json');
		});

		test('should return parsed error text when backend body is not JSON', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 502,
				text: () => Promise.resolve('Bad Gateway')
			});

			const result = (await actions.createConnection(
				createEvent({
					uuid_microduct_from: 'md-1',
					uuid_microduct_to: 'md-2',
					uuid_node: 'node-1',
					uuid_trench_from: 'trench-1',
					uuid_trench_to: 'trench-2'
				})
			)) as Record<string, unknown>;

			expect(result.status).toBe(502);
			expect((result.data as Record<string, unknown>).error).toBe('Bad Gateway');
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
			const result = (await actions.deleteConnection(createEvent())) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('uuid');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Not found' }))
			});

			const result = (await actions.deleteConnection(createEvent({ uuid: 'conn-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(404);
			expect((result.data as Record<string, unknown>).error).toBe('Not found');
		});

		test('should fall back to status message when error body is empty', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.resolve('')
			});

			const result = (await actions.deleteConnection(createEvent({ uuid: 'conn-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe(
				'Request failed with status: 500'
			);
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.deleteConnection(createEvent({ uuid: 'conn-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal server error');
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
			const result = (await actions.getTrenchesNearNode(
				createEvent({ project: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('node_name');
		});

		test('should return fail(400) when project is missing', async () => {
			const result = (await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('project');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.resolve(JSON.stringify({ error: 'Server error' }))
			});

			const result = (await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A', project: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
		});

		test('should fall back to status message when error body is empty', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.resolve('')
			});

			const result = (await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A', project: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe(
				'Request failed with status: 500'
			);
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.getTrenchesNearNode(
				createEvent({ node_name: 'Node A', project: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal server error');
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
			const result = (await actions.getTrenchSelections(createEvent())) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('node_uuid');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve(JSON.stringify({ error: 'Node not found' }))
			});

			const result = (await actions.getTrenchSelections(
				createEvent({ node_uuid: 'node-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(404);
			expect((result.data as Record<string, unknown>).error).toBe('Node not found');
		});

		test('should wrap non-JSON error body from backend', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.resolve('Internal Error')
			});

			const result = (await actions.getTrenchSelections(
				createEvent({ node_uuid: 'node-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal Error');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.getTrenchSelections(
				createEvent({ node_uuid: 'node-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal server error');
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
			const result = (await actions.saveTrenchSelections(createEvent())) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('node_uuid');
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

		test('should omit Cookie header when api-access-token is absent', async () => {
			mockCookies.get = vi.fn(() => null);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ saved: true })
			});

			await actions.saveTrenchSelections(
				createEvent({ node_uuid: 'node-1', trench_uuids: '["t-1"]' })
			);

			const headers = mockFetch.mock.calls[0][1].headers as Headers;
			expect(headers.get('Cookie')).toBeNull();
			expect(headers.get('Content-Type')).toBe('application/json');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				text: () => Promise.resolve(JSON.stringify({ error: 'Invalid trench set' }))
			});

			const result = (await actions.saveTrenchSelections(
				createEvent({ node_uuid: 'node-1', trench_uuids: '["t-1"]' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(422);
			expect((result.data as Record<string, unknown>).error).toBe('Invalid trench set');
		});

		test('should wrap non-JSON error body from backend', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				text: () => Promise.resolve('Service Unavailable')
			});

			const result = (await actions.saveTrenchSelections(
				createEvent({ node_uuid: 'node-1', trench_uuids: '["t-1"]' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(503);
			expect((result.data as Record<string, unknown>).error).toBe('Service Unavailable');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.saveTrenchSelections(
				createEvent({ node_uuid: 'node-1', trench_uuids: '["t-1"]' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Internal server error');
		});
	});
});
