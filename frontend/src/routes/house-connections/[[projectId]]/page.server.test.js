import { beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(() => Promise.resolve({ nodeTypes: [{ uuid: 'nt-1', name: 'Type A' }], nodeTypesError: null })),
	getSurfaces: vi.fn(() => Promise.resolve({ surfaces: [{ uuid: 's-1', name: 'Asphalt' }], surfacesError: null })),
	getConstructionTypes: vi.fn(() => Promise.resolve({ constructionTypes: [{ uuid: 'ct-1', name: 'Open' }], constructionTypesError: null })),
	getAreaTypes: vi.fn(() => Promise.resolve({ areaTypes: [{ uuid: 'at-1', name: 'Residential' }], areaTypesError: null }))
}));

vi.mock('$lib/server/conduitData', () => ({
	getPipesInTrench: vi.fn(),
	getMicroducts: vi.fn()
}));

vi.mock('$lib/server/featureSearch', () => ({
	searchFeaturesInProject: vi.fn(),
	getFeatureDetailsByType: vi.fn(),
	getTrenchUuidsForConduit: vi.fn(),
	getLayerExtent: vi.fn()
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('house-connections +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		mockCookies = {
			get: vi.fn(() => 'mock-token'),
			set: vi.fn()
		};
	});

	/**
	 * Creates a mock request event with form data.
	 * @param {Record<string, string>} formFields - Key-value pairs for form data
	 * @param {Record<string, string>} [params] - Route params
	 * @returns {any}
	 */
	function createEvent(formFields = {}, params = {}) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(formFields)) {
			formData.set(key, value);
		}
		return {
			request: { formData: () => Promise.resolve(formData) },
			fetch: mockFetch,
			cookies: mockCookies,
			params
		};
	}

	describe('load', () => {
		test('should load all attribute data in parallel', async () => {
			const result = await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

			expect(result).toEqual({
				nodeTypes: [{ uuid: 'nt-1', name: 'Type A' }],
				nodeTypesError: null,
				surfaces: [{ uuid: 's-1', name: 'Asphalt' }],
				surfacesError: null,
				constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
				constructionTypesError: null,
				areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
				areaTypesError: null
			});
		});
	});

	describe('getPipesInTrench', () => {
		test('should call getPipesInTrench with trench UUID', async () => {
			const { getPipesInTrench } = await import('$lib/server/conduitData');
			/** @type {any} */ (getPipesInTrench).mockResolvedValueOnce([{ uuid: 'pipe-1' }]);

			const result = await actions.getPipesInTrench(createEvent({ uuid: 'trench-123' }));

			expect(getPipesInTrench).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench-123');
			expect(result).toEqual([{ uuid: 'pipe-1' }]);
		});
	});

	describe('getMicroducts', () => {
		test('should call getMicroducts with pipe UUID', async () => {
			const { getMicroducts } = await import('$lib/server/conduitData');
			/** @type {any} */ (getMicroducts).mockResolvedValueOnce([{ uuid: 'md-1', color: 'red' }]);

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
			/** @type {any} */
			const result = await actions.assignNodeToMicroduct(
				createEvent({ nodeUuid: 'node-1' })
			);

			expect(result?.status).toBe(400);
			expect(result?.data?.error).toBe('Microduct UUID is required');
		});

		test('should return fail(400) when nodeUuid is missing', async () => {
			/** @type {any} */
			const result = await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1' })
			);

			expect(result?.status).toBe(400);
			expect(result?.data?.error).toBe('Node UUID is required');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ error: 'Invalid node' })
			});

			/** @type {any} */
			const result = await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1', nodeUuid: 'node-1' })
			);

			expect(result?.status).toBe(422);
			expect(result?.data?.error).toBe('Invalid node');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.assignNodeToMicroduct(
				createEvent({ microductUuid: 'md-1', nodeUuid: 'node-1' })
			);

			expect(result?.status).toBe(500);
			expect(result?.data?.error).toBe('Internal server error');
		});
	});

	describe('removeNodeFromMicroduct', () => {
		test('should send PATCH request with null node', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'md-1', uuid_node_id: null })
			});

			const result = await actions.removeNodeFromMicroduct(
				createEvent({ microductUuid: 'md-1' })
			);

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
			/** @type {any} */
			const result = await actions.removeNodeFromMicroduct(createEvent());

			expect(result?.status).toBe(400);
			expect(result?.data?.error).toBe('Microduct UUID is required');
		});

		test('should return fail on backend error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ error: 'Not found' })
			});

			/** @type {any} */
			const result = await actions.removeNodeFromMicroduct(
				createEvent({ microductUuid: 'md-1' })
			);

			expect(result?.status).toBe(404);
			expect(result?.data?.error).toBe('Not found');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			/** @type {any} */
			const result = await actions.removeNodeFromMicroduct(
				createEvent({ microductUuid: 'md-1' })
			);

			expect(result?.status).toBe(500);
			expect(result?.data?.error).toBe('Internal server error');
		});
	});

	describe('searchFeatures', () => {
		test('should call searchFeaturesInProject with query and projectId', async () => {
			const { searchFeaturesInProject } = await import('$lib/server/featureSearch');
			/** @type {any} */ (searchFeaturesInProject).mockResolvedValueOnce([
				{ value: 'uuid-1', label: 'Node 1', type: 'node', uuid: 'uuid-1' }
			]);

			const result = await actions.searchFeatures(
				createEvent({ searchQuery: 'test' }, { projectId: 'proj-1' })
			);

			expect(searchFeaturesInProject).toHaveBeenCalledWith(mockFetch, mockCookies, 'test', 'proj-1');
			expect(result).toEqual([{ value: 'uuid-1', label: 'Node 1', type: 'node', uuid: 'uuid-1' }]);
		});

		test('should pass empty string when projectId is undefined', async () => {
			const { searchFeaturesInProject } = await import('$lib/server/featureSearch');
			/** @type {any} */ (searchFeaturesInProject).mockResolvedValueOnce([]);

			await actions.searchFeatures(createEvent({ searchQuery: 'test' }, {}));

			expect(searchFeaturesInProject).toHaveBeenCalledWith(mockFetch, mockCookies, 'test', '');
		});
	});

	describe('getFeatureDetails', () => {
		test('should call getFeatureDetailsByType with correct params', async () => {
			const { getFeatureDetailsByType } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getFeatureDetailsByType).mockResolvedValueOnce({
				success: true,
				feature: { id: 'uuid-1', properties: { name: 'Node 1' } }
			});

			const result = await actions.getFeatureDetails(
				createEvent(
					{ featureType: 'node', featureUuid: 'uuid-1' },
					{ projectId: 'proj-1' }
				)
			);

			expect(getFeatureDetailsByType).toHaveBeenCalledWith(
				mockFetch, mockCookies, 'node', 'uuid-1', 'proj-1'
			);
			expect(result).toEqual({
				success: true,
				feature: { id: 'uuid-1', properties: { name: 'Node 1' } }
			});
		});

		test('should pass empty string when projectId is undefined', async () => {
			const { getFeatureDetailsByType } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getFeatureDetailsByType).mockResolvedValueOnce({ success: true, feature: {} });

			await actions.getFeatureDetails(
				createEvent({ featureType: 'trench', featureUuid: 'uuid-2' }, {})
			);

			expect(getFeatureDetailsByType).toHaveBeenCalledWith(
				mockFetch, mockCookies, 'trench', 'uuid-2', ''
			);
		});
	});

	describe('getConduitTrenches', () => {
		test('should call getTrenchUuidsForConduit with conduit UUID', async () => {
			const { getTrenchUuidsForConduit } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getTrenchUuidsForConduit).mockResolvedValueOnce({
				success: true,
				trenches: [],
				trenchUuids: ['t-1', 't-2']
			});

			const result = await actions.getConduitTrenches(
				createEvent({ conduitUuid: 'conduit-1' })
			);

			expect(getTrenchUuidsForConduit).toHaveBeenCalledWith(mockFetch, mockCookies, 'conduit-1');
			expect(result).toEqual({
				success: true,
				trenches: [],
				trenchUuids: ['t-1', 't-2']
			});
		});
	});

	describe('getLayerExtent', () => {
		test('should call getLayerExtent with layer type and project ID', async () => {
			const { getLayerExtent } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getLayerExtent).mockResolvedValueOnce({
				extent: [1, 2, 3, 4],
				layer: 'trench'
			});

			const result = await actions.getLayerExtent(
				createEvent({ layerType: 'trench', projectId: 'proj-1' })
			);

			expect(getLayerExtent).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench', 'proj-1');
			expect(result).toEqual({ extent: [1, 2, 3, 4], layer: 'trench' });
		});
	});
});
