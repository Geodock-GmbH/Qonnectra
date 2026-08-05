import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPipesInTrench } from '$lib/server/conduitData';
import { searchFeaturesInProject } from '$lib/server/featureSearch';

import { actions, load } from './+page.server';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		const httpError = new Error(message) as Error & { status: number };
		httpError.status = status;
		throw httpError;
	},
	fail: (status: number, data: unknown) => ({ status, data })
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Cookie: 'api-access-token=tok' })
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(() => Promise.resolve({ nodeTypes: [], nodeTypesError: null })),
	getSurfaces: vi.fn(() => Promise.resolve({ surfaces: [], surfacesError: null })),
	getConstructionTypes: vi.fn(() =>
		Promise.resolve({ constructionTypes: [], constructionTypesError: null })
	),
	getAreaTypes: vi.fn(() => Promise.resolve({ areaTypes: [], areaTypesError: null }))
}));

vi.mock('$lib/server/conduitData', () => ({
	getPipesInTrench: vi.fn(() => Promise.resolve({ pipes: [] })),
	getTrenchesForConduit: vi.fn(() => Promise.resolve({ trench_uuids: [] }))
}));

vi.mock('$lib/server/featureSearch', () => ({
	searchFeaturesInProject: vi.fn(() => Promise.resolve([])),
	getFeatureDetailsByType: vi.fn(() => Promise.resolve({ success: true })),
	getTrenchUuidsForConduit: vi.fn(() => Promise.resolve({ success: true })),
	getLayerExtent: vi.fn(() => Promise.resolve({ extent: null, layer: 'trench' }))
}));

const mockCookies = {} as Cookies;

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}
	return { formData: () => Promise.resolve(formData) };
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('load', () => {
	test('should return attribute types without conduits when params are missing', async () => {
		const fetchMock = vi.fn();

		const result = await load({
			fetch: fetchMock,
			params: {},
			depends: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result.conduits).toEqual([]);
		expect(result.conduitsError).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should load and map conduits for project and flag', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					results: [{ uuid: 'c1', name: 'DA 50', conduit_type: 'Rohr' }]
				})
		});

		const result = await load({
			fetch: fetchMock,
			params: { projectId: '7', flagId: '1' },
			depends: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/conduit/all/?project=7&flag=1&no_pagination=true',
			expect.anything()
		);
		expect(result.conduits).toEqual([{ value: 'c1', label: 'DA 50 (Rohr)' }]);
	});

	test('should report a conduit error on failure', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await load({
			fetch: fetchMock,
			params: { projectId: '7', flagId: '1' },
			depends: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result.conduits).toEqual([]);
		expect(result.conduitsError).toBe('title_error_fetching_conduits');
	});
});

describe('getTrenchData action', () => {
	test('should fetch trench data by label', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ features: [] })
		});

		const result = await actions.getTrenchData({
			request: makeRequest({ trenchLabel: 'T-42' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/trench/?id_trench=T-42',
			expect.anything()
		);
		expect(result).toEqual({ success: true, trenchData: { features: [] } });
	});

	test('should reject requests without a label', async () => {
		await expect(
			actions.getTrenchData({
				request: makeRequest({}),
				fetch: vi.fn(),
				cookies: mockCookies
			} as never)
		).rejects.toMatchObject({ status: 400 });
	});
});

describe('calculateRoute action', () => {
	test('should post the routing request with parsed parameters', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ route: [] })
		});

		const result = await actions.calculateRoute({
			request: makeRequest({
				startTrenchId: 'T-1',
				endTrenchId: 'T-2',
				projectId: '7',
				tolerance: '1.5'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({
			start_trench_id: 'T-1',
			end_trench_id: 'T-2',
			project_id: [7],
			tolerance: [1.5]
		});
		expect(result).toEqual({ success: true, routeData: { route: [] } });
	});

	test('should fail when parameters are missing', async () => {
		const result = await actions.calculateRoute({
			request: makeRequest({ startTrenchId: 'T-1' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});

	test('should extract error messages from HTML error pages', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: () => Promise.resolve('<html><title>Kein Pfad gefunden</title></html>')
		});

		const result = await actions.calculateRoute({
			request: makeRequest({
				startTrenchId: 'T-1',
				endTrenchId: 'T-2',
				projectId: '7',
				tolerance: '1'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(result).toEqual({ status: 500, data: { error: 'Kein Pfad gefunden' } });
	});

	test('should pass through JSON error payloads', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			text: () => Promise.resolve(JSON.stringify({ error: 'Ungültige Toleranz' }))
		});

		const result = await actions.calculateRoute({
			request: makeRequest({
				startTrenchId: 'T-1',
				endTrenchId: 'T-2',
				projectId: '7',
				tolerance: '1'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(result).toEqual({ status: 400, data: { error: 'Ungültige Toleranz' } });
	});
});

describe('trench connection actions', () => {
	test('getTrenchConnections should map connections to combobox entries', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve([
					{
						uuid: 'conn-1',
						trench: { id: 'trench-1', properties: { id_trench: 'T-42' } }
					}
				])
		});

		const result = await actions.getTrenchConnections({
			request: makeRequest({ conduitId: 'c1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(result).toEqual({
			success: true,
			trenches: [{ value: 'conn-1', label: 'T-42', trench: 'trench-1' }]
		});
	});

	test('deleteTrenchConnection should call the DELETE endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });

		const result = await actions.deleteTrenchConnection({
			request: makeRequest({ connectionId: 'conn-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/trench_conduit_connection/conn-1/',
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(result).toEqual({ success: true });
	});

	test('createTrenchConnection should post conduit and trench ids', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ uuid: 'conn-2' })
		});

		const result = await actions.createTrenchConnection({
			request: makeRequest({ conduitId: 'c1', trenchId: 't1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({ uuid_conduit: 'c1', uuid_trench: 't1' });
		expect(result).toEqual({ success: true, connection: { uuid: 'conn-2' } });
	});

	test('createTrenchConnection should fail without both ids', async () => {
		const result = await actions.createTrenchConnection({
			request: makeRequest({ conduitId: 'c1' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});
});

describe('delegating actions', () => {
	test('searchFeatures should forward query and project', async () => {
		await actions.searchFeatures({
			request: makeRequest({ searchQuery: 'haupt', projectId: '7' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(searchFeaturesInProject).toHaveBeenCalledWith(
			expect.any(Function),
			mockCookies,
			'haupt',
			'7'
		);
	});

	test('getPipesInTrench should forward the trench uuid', async () => {
		await actions.getPipesInTrench({
			request: makeRequest({ uuid: 'trench-1' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(getPipesInTrench).toHaveBeenCalledWith(expect.any(Function), mockCookies, 'trench-1');
	});
});
