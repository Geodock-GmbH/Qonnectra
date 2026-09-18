import { beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(() =>
		Promise.resolve({ nodeTypes: [{ id: 1, node_type: 'Type A' }], nodeTypesError: null })
	),
	getSurfaces: vi.fn(() =>
		Promise.resolve({ surfaces: [{ id: 1, surface: 'Asphalt' }], surfacesError: null })
	),
	getConstructionTypes: vi.fn(() =>
		Promise.resolve({
			constructionTypes: [{ id: 1, construction_type: 'Open' }],
			constructionTypesError: null
		})
	),
	getAreaTypes: vi.fn(() =>
		Promise.resolve({ areaTypes: [{ id: 1, area_type: 'Residential' }], areaTypesError: null })
	)
}));

vi.mock('$lib/server/conduitData', () => ({
	getPipesInTrench: vi.fn(),
	getMicroducts: vi.fn()
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('house-connections +page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: Record<string, unknown>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		mockCookies = {
			get: vi.fn(() => 'mock-token'),
			set: vi.fn()
		};
	});

	function createEvent(
		formFields: Record<string, string> = {},
		params: Record<string, string> = {}
	): Parameters<typeof actions.getPipesInTrench>[0] {
		const formData = new FormData();
		for (const [key, value] of Object.entries(formFields)) {
			formData.set(key, value);
		}
		return {
			request: { formData: () => Promise.resolve(formData) },
			fetch: mockFetch,
			cookies: mockCookies,
			params
		} as unknown as Parameters<typeof actions.getPipesInTrench>[0];
	}

	describe('load', () => {
		test('should load all attribute data in parallel', async () => {
			const result = await load({
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof load>[0]);

			expect(result).toEqual({
				nodeTypes: [{ id: 1, node_type: 'Type A' }],
				nodeTypesError: null,
				surfaces: [{ id: 1, surface: 'Asphalt' }],
				surfacesError: null,
				constructionTypes: [{ id: 1, construction_type: 'Open' }],
				constructionTypesError: null,
				areaTypes: [{ id: 1, area_type: 'Residential' }],
				areaTypesError: null
			});
		});
	});

	describe('getPipesInTrench', () => {
		test('should call getPipesInTrench with trench UUID', async () => {
			const { getPipesInTrench } = await import('$lib/server/conduitData');
			(getPipesInTrench as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ uuid: 'pipe-1' }]);

			const result = await actions.getPipesInTrench(createEvent({ uuid: 'trench-123' }));

			expect(getPipesInTrench).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench-123');
			expect(result).toEqual([{ uuid: 'pipe-1' }]);
		});
	});

	describe('getMicroducts', () => {
		test('should call getMicroducts with pipe UUID', async () => {
			const { getMicroducts } = await import('$lib/server/conduitData');
			(getMicroducts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
				{ uuid: 'md-1', color: 'red' }
			]);

			const result = await actions.getMicroducts(createEvent({ uuid: 'pipe-456' }));

			expect(getMicroducts).toHaveBeenCalledWith(mockFetch, mockCookies, 'pipe-456');
			expect(result).toEqual([{ uuid: 'md-1', color: 'red' }]);
		});
	});

	describe('assignNodeToMicroduct', () => {
		test('should send PATCH request to assign node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'md-1', uuid_node_id: 'node-1' })
			});

			const result = await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1', nodeUuid: 'node-1' })
			);

			expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/microduct/md-1/', {
				method: 'PATCH',
				credentials: 'include',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					Cookie: 'api-access-token=mock-token'
				}),
				body: JSON.stringify({ uuid_node_id: 'node-1' })
			});
			expect(result).toEqual({ microduct: { uuid: 'md-1', uuid_node_id: 'node-1' } });
		});

		test('should return fail(400) when microductUuid is missing', async () => {
			const result = (await actions.assignNodeToMicroduct(
				createEvent({ nodeUuid: 'node-1' })
			)) as Record<string, unknown>;

			expect(result?.status).toBe(400);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Microduct UUID is required');
		});

		test('should return fail(400) when nodeUuid is missing', async () => {
			const result = (await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1' })
			)) as Record<string, unknown>;

			expect(result?.status).toBe(400);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Node UUID is required');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ error: 'Invalid node' })
			});

			const result = (await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1', nodeUuid: 'node-1' })
			)) as Record<string, unknown>;

			expect(result?.status).toBe(422);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Invalid node');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1', nodeUuid: 'node-1' })
			)) as Record<string, unknown>;

			expect(result?.status).toBe(500);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Internal server error');
		});
	});

	describe('removeNodeFromMicroduct', () => {
		test('should send PATCH request with null node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'md-1', uuid_node_id: null })
			});

			const result = await actions.removeNodeFromMicroduct(createEvent({ microductUuid: 'md-1' }));

			expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/microduct/md-1/', {
				method: 'PATCH',
				credentials: 'include',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				}),
				body: JSON.stringify({ uuid_node_id: null })
			});
			expect(result).toEqual({ microduct: { uuid: 'md-1', uuid_node_id: null } });
		});

		test('should return fail(400) when microductUuid is missing', async () => {
			const result = (await actions.removeNodeFromMicroduct(createEvent())) as Record<
				string,
				unknown
			>;

			expect(result?.status).toBe(400);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Microduct UUID is required');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ error: 'Not found' })
			});

			const result = (await actions.removeNodeFromMicroduct(
				createEvent({ microductUuid: 'md-1' })
			)) as Record<string, unknown>;

			expect(result?.status).toBe(404);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Not found');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.removeNodeFromMicroduct(
				createEvent({ microductUuid: 'md-1' })
			)) as Record<string, unknown>;

			expect(result?.status).toBe(500);
			expect((result?.data as Record<string, unknown>)?.error).toBe('Internal server error');
		});
	});
});
