import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: Record<string, unknown>) => ({ status, data })
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(),
	getSurfaces: vi.fn(),
	getConstructionTypes: vi.fn(),
	getAreaTypes: vi.fn()
}));

vi.mock('$lib/server/featureSearch', () => ({
	searchFeaturesInProject: vi.fn(),
	getFeatureDetailsByType: vi.fn(),
	getTrenchUuidsForConduit: vi.fn(),
	getLayerExtent: vi.fn()
}));

const { actions, load } = await import('./+page.server.js');
const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
	await import('$lib/server/attributes');
const {
	searchFeaturesInProject,
	getFeatureDetailsByType,
	getTrenchUuidsForConduit,
	getLayerExtent
} = await import('$lib/server/featureSearch');

describe('fault-simulation +page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: Record<string, unknown>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		mockCookies = {
			get: vi.fn((name: string) => {
				if (name === 'api-access-token') return 'mock-token';
				return null;
			}),
			set: vi.fn()
		};
	});

	function createEvent(
		formFields: Record<string, string> = {},
		params: Record<string, string> = {}
	) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(formFields)) {
			formData.set(key, value);
		}
		return {
			request: { formData: () => Promise.resolve(formData) },
			fetch: mockFetch,
			cookies: mockCookies,
			params
		} as unknown as import('@sveltejs/kit').RequestEvent<
			Record<string, string>,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			any
		>;
	}

	describe('load', () => {
		test('should fetch all attribute types in parallel', async () => {
			const nodeTypesData = { nodeTypes: [{ uuid: 'nt-1', name: 'Splice' }], nodeTypesError: null };
			const surfacesData = { surfaces: [{ uuid: 's-1', name: 'Asphalt' }], surfacesError: null };
			const constructionTypesData = {
				constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
				constructionTypesError: null
			};
			const areaTypesData = {
				areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
				areaTypesError: null
			};

			vi.mocked(getNodeTypes).mockResolvedValue(nodeTypesData);
			vi.mocked(getSurfaces).mockResolvedValue(surfacesData);
			vi.mocked(getConstructionTypes).mockResolvedValue(constructionTypesData);
			vi.mocked(getAreaTypes).mockResolvedValue(areaTypesData);

			const result = await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
				typeof load
			>[0]);

			expect(result).toEqual({
				nodeTypes: [{ uuid: 'nt-1', name: 'Splice' }],
				nodeTypesError: null,
				surfaces: [{ uuid: 's-1', name: 'Asphalt' }],
				surfacesError: null,
				constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
				constructionTypesError: null,
				areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
				areaTypesError: null
			});
		});

		test('should pass fetch and cookies to all attribute functions', async () => {
			vi.mocked(getNodeTypes).mockResolvedValue({ nodeTypes: [] } as never);
			vi.mocked(getSurfaces).mockResolvedValue({ surfaces: [] } as never);
			vi.mocked(getConstructionTypes).mockResolvedValue({ constructionTypes: [] } as never);
			vi.mocked(getAreaTypes).mockResolvedValue({ areaTypes: [] } as never);

			await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
				typeof load
			>[0]);

			expect(getNodeTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
			expect(getSurfaces).toHaveBeenCalledWith(mockFetch, mockCookies);
			expect(getConstructionTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
			expect(getAreaTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
		});

		test('should include error fields when attribute fetches fail', async () => {
			vi.mocked(getNodeTypes).mockResolvedValue({
				nodeTypes: [],
				nodeTypesError: 'Failed to load'
			});
			vi.mocked(getSurfaces).mockResolvedValue({ surfaces: [], surfacesError: null });
			vi.mocked(getConstructionTypes).mockResolvedValue({
				constructionTypes: [],
				constructionTypesError: null
			});
			vi.mocked(getAreaTypes).mockResolvedValue({ areaTypes: [], areaTypesError: null });

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.nodeTypesError).toBe('Failed to load');
			expect(result.nodeTypes).toEqual([]);
		});
	});

	describe('simulate', () => {
		test('should send correct request to fault-simulation API', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						summary: { total_cables_affected: 2 },
						trench: { id_trench: 'T-001' },
						conduits: [],
						cables: []
					})
			});

			await actions.simulate(
				createEvent({ pointX: '100.5', pointY: '200.3', projectId: 'proj-1' })
			);

			expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/fault-simulation/', {
				method: 'POST',
				credentials: 'include',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				}),
				body: JSON.stringify({ point: [100.5, 200.3], project_id: 'proj-1' })
			});
		});

		test('should return success with simulation result', async () => {
			const simulationResult = {
				summary: { total_cables_affected: 2, affected_addresses: 5 },
				trench: { id_trench: 'T-001', construction_type: 'open' },
				conduits: [{ uuid: 'c-1', name: 'Conduit A' }],
				cables: [{ uuid: 'cab-1', name: 'Cable 1' }],
				affected_addresses_details: [{ uuid: 'addr-1', id_address: 'A-001' }],
				geometry: {
					affected_trenches: { type: 'FeatureCollection', features: [] },
					affected_nodes: { type: 'FeatureCollection', features: [] },
					affected_addresses: { type: 'FeatureCollection', features: [] }
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(simulationResult)
			});

			const result = await actions.simulate(
				createEvent({ pointX: '100', pointY: '200', projectId: 'proj-1' })
			);

			expect(result).toEqual({ success: true, result: simulationResult });
		});

		test('should return fail(400) when coordinates are missing', async () => {
			const result = (await actions.simulate(createEvent({ projectId: 'proj-1' }))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toBe('Valid coordinates are required');
		});

		test('should return fail(400) when coordinates are invalid', async () => {
			const result = (await actions.simulate(
				createEvent({ pointX: 'abc', pointY: '200', projectId: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toBe('Valid coordinates are required');
		});

		test('should return fail(400) when projectId is empty string', async () => {
			const result = (await actions.simulate(
				createEvent({ pointX: '100', pointY: '200', projectId: '' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toBe('Project ID is required');
		});

		test('should return fail with API status on non-ok response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ error: 'Trench not found' })
			});

			const result = (await actions.simulate(
				createEvent({ pointX: '100', pointY: '200', projectId: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(404);
			expect((result.data as Record<string, unknown>).error).toBe('Trench not found');
		});

		test('should return generic error when response body is not JSON', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error('Invalid JSON'))
			});

			const result = (await actions.simulate(
				createEvent({ pointX: '100', pointY: '200', projectId: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Simulation failed');
		});

		test('should return fail(500) on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

			const result = (await actions.simulate(
				createEvent({ pointX: '100', pointY: '200', projectId: 'proj-1' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe(
				'Internal server error during simulation'
			);
		});
	});

	describe('searchFeatures', () => {
		test('should delegate to searchFeaturesInProject with correct params', async () => {
			const searchResults = [
				{ value: 'uuid-1', label: 'Node A (Node)', type: 'node', uuid: 'uuid-1' }
			];
			vi.mocked(searchFeaturesInProject).mockResolvedValue(searchResults as never);

			const result = await actions.searchFeatures(
				createEvent({ searchQuery: 'Node A' }, { projectId: 'proj-1' })
			);

			expect(searchFeaturesInProject).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'Node A',
				'proj-1'
			);
			expect(result).toEqual(searchResults);
		});

		test('should default projectId to empty string when not in params', async () => {
			vi.mocked(searchFeaturesInProject).mockResolvedValue([]);

			await actions.searchFeatures(createEvent({ searchQuery: 'test' }, {}));

			expect(searchFeaturesInProject).toHaveBeenCalledWith(mockFetch, mockCookies, 'test', '');
		});
	});

	describe('getFeatureDetails', () => {
		test('should delegate to getFeatureDetailsByType with correct params', async () => {
			const featureResult = {
				success: true,
				feature: { id: 'uuid-1', properties: { name: 'Node A' } }
			};
			vi.mocked(getFeatureDetailsByType).mockResolvedValue(featureResult as never);

			const result = await actions.getFeatureDetails(
				createEvent({ featureType: 'node', featureUuid: 'uuid-1' }, { projectId: 'proj-1' })
			);

			expect(getFeatureDetailsByType).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'node',
				'uuid-1',
				'proj-1'
			);
			expect(result).toEqual(featureResult);
		});

		test('should default projectId to empty string when not in params', async () => {
			vi.mocked(getFeatureDetailsByType).mockResolvedValue({ success: true } as never);

			await actions.getFeatureDetails(
				createEvent({ featureType: 'trench', featureUuid: 'uuid-1' }, {})
			);

			expect(getFeatureDetailsByType).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'trench',
				'uuid-1',
				''
			);
		});
	});

	describe('getConduitTrenches', () => {
		test('should delegate to getTrenchUuidsForConduit with correct params', async () => {
			const trenchResult = {
				success: true,
				trenches: [{ id: 'trench-1' }],
				trenchUuids: ['trench-uuid-1']
			};
			vi.mocked(getTrenchUuidsForConduit).mockResolvedValue(trenchResult as never);

			const result = await actions.getConduitTrenches(
				createEvent({ conduitUuid: 'conduit-uuid-1' })
			);

			expect(getTrenchUuidsForConduit).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'conduit-uuid-1'
			);
			expect(result).toEqual(trenchResult);
		});
	});

	describe('getLayerExtent', () => {
		test('should delegate to getLayerExtent helper with correct params', async () => {
			const extentResult = { extent: [1, 2, 3, 4], layer: 'trench' };
			vi.mocked(getLayerExtent).mockResolvedValue(extentResult as never);

			const result = await actions.getLayerExtent(
				createEvent({ layerType: 'trench', projectId: 'proj-1' })
			);

			expect(getLayerExtent).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench', 'proj-1');
			expect(result).toEqual(extentResult);
		});

		test('should pass different layer types correctly', async () => {
			vi.mocked(getLayerExtent).mockResolvedValue({ extent: null, layer: 'address' });

			await actions.getLayerExtent(createEvent({ layerType: 'address', projectId: 'proj-2' }));

			expect(getLayerExtent).toHaveBeenCalledWith(mockFetch, mockCookies, 'address', 'proj-2');
		});
	});
});
