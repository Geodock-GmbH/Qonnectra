import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	firstFeature,
	getFeatureDetailsByType,
	getTrenchesForConduit,
	mapSearchResults,
	searchFeaturesInProject
} from './feature-search-data';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_address: () => 'Adresse',
		form_node: () => 'Knoten',
		nav_trench: () => 'Graben',
		form_conduit: () => 'Rohr',
		form_area: () => 'Fläche'
	}
}));

const headers = { Cookie: 'api-access-token=mock-token' };
const fetchMock = vi.fn();

function okResponse(data: unknown) {
	return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function failedResponse(status: number, body: unknown = {}) {
	return { ok: false, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

const geoJsonAddress = {
	id: 'addr-1',
	properties: { street: 'Hauptstraße', housenumber: '5', house_number_suffix: 'a' }
};

describe('mapSearchResults', () => {
	test('should label every feature kind with its translated type', () => {
		const results = mapSearchResults({
			addresses: { features: [geoJsonAddress] },
			nodes: { features: [{ id: 'node-1', properties: { name: 'PoP-1' } }] },
			trenches: { features: [{ id: 'trench-1', properties: { id_trench: 'T-42' } }] },
			conduits: { results: [{ uuid: 'conduit-1', name: 'C-1', conduit_type: 'DA 50' }] },
			areas: { features: [{ id: 'area-1', properties: { name: 'Süd' } }] }
		});

		expect(results).toEqual([
			{ value: 'addr-1', label: 'Hauptstraße 5 a (Adresse)', type: 'address', uuid: 'addr-1' },
			{ value: 'node-1', label: 'PoP-1 (Knoten)', type: 'node', uuid: 'node-1', name: 'PoP-1' },
			{
				value: 'trench-1',
				label: 'T-42 (Graben)',
				type: 'trench',
				uuid: 'trench-1',
				id_trench: 'T-42'
			},
			{
				value: 'conduit-1',
				label: 'C-1 - DA 50 (Rohr)',
				type: 'conduit',
				uuid: 'conduit-1',
				name: 'C-1'
			},
			{ value: 'area-1', label: 'Süd (Fläche)', type: 'area', uuid: 'area-1', name: 'Süd' }
		]);
	});

	test('should support non-GeoJSON address rows and skip incomplete features', () => {
		const results = mapSearchResults({
			addresses: { results: [{ uuid: 'addr-2', street: 'Dorfweg', housenumber: '3' }] },
			nodes: { features: [{ id: 'node-1', properties: {} }] },
			trenches: [],
			conduits: { results: [{ uuid: 'conduit-1' }] },
			areas: null
		});

		expect(results).toEqual([
			{ value: 'addr-2', label: 'Dorfweg 3 (Adresse)', type: 'address', uuid: 'addr-2' }
		]);
	});

	test('should omit the conduit type when the conduit has none', () => {
		const [result] = mapSearchResults({
			addresses: [],
			nodes: [],
			trenches: [],
			conduits: [{ uuid: 'conduit-1', name: 'C-1' }],
			areas: []
		});

		expect(result.label).toBe('C-1 (Rohr)');
	});
});

describe('firstFeature', () => {
	test('should unwrap a paginated GeoJSON collection', () => {
		const feature = { id: 'u1', properties: {} };

		expect(firstFeature({ results: { features: [feature] } })).toEqual(feature);
	});

	test('should unwrap a bare array', () => {
		const feature = { id: 'u1', properties: {} };

		expect(firstFeature([feature])).toEqual(feature);
	});

	test('should return undefined when nothing matched', () => {
		expect(firstFeature({ results: { features: [] } })).toBeUndefined();
		expect(firstFeature([])).toBeUndefined();
		expect(firstFeature(null)).toBeUndefined();
	});
});

describe('searchFeaturesInProject', () => {
	test('should query all five endpoints scoped to the project', async () => {
		fetchMock.mockImplementation(() => Promise.resolve(okResponse({ features: [] })));

		await searchFeaturesInProject(headers, 'haupt straße', '7');

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'http://localhost:8000/address/all/?search=haupt%20stra%C3%9Fe&project=7',
			'http://localhost:8000/node/all/?search=haupt%20stra%C3%9Fe&project=7&include_excluded=true',
			'http://localhost:8000/trench/all/?search=haupt%20stra%C3%9Fe&project=7',
			'http://localhost:8000/conduit/all/?search=haupt%20stra%C3%9Fe&project=7',
			'http://localhost:8000/area/all/?search=haupt%20stra%C3%9Fe&project=7'
		]);
		expect(fetchMock.mock.calls[0][1]).toEqual({ headers });
	});

	test('should search all projects without a project id', async () => {
		fetchMock.mockImplementation(() => Promise.resolve(okResponse({ features: [] })));

		await searchFeaturesInProject(headers, 'haupt', '');

		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/address/all/?search=haupt');
	});

	test('should return the mapped results', async () => {
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(
				okResponse(
					url.includes('node/all/')
						? { features: [{ id: 'node-1', properties: { name: 'PoP-1' } }] }
						: { features: [] }
				)
			)
		);

		const results = await searchFeaturesInProject(headers, 'pop', '7');

		expect(results).toEqual([
			{ value: 'node-1', label: 'PoP-1 (Knoten)', type: 'node', uuid: 'node-1', name: 'PoP-1' }
		]);
	});

	test('should fail with the backend status when any endpoint fails', async () => {
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(
				url.includes('node/all/')
					? failedResponse(503, { detail: 'Search is down' })
					: okResponse({ features: [] })
			)
		);

		await expect(searchFeaturesInProject(headers, 'haupt', '7')).rejects.toMatchObject({
			status: 503,
			body: { message: 'Search is down' }
		});
	});
});

describe('getFeatureDetailsByType', () => {
	test.each([
		['node', 'http://localhost:8000/node/?uuid=u1&project=7'],
		['trench', 'http://localhost:8000/trench/?uuid=u1&project=7'],
		['address', 'http://localhost:8000/address/?uuid=u1&project=7'],
		['area', 'http://localhost:8000/area/?uuid=u1&project=7']
	] as const)('should fetch %s details from the right endpoint', async (type, expectedUrl) => {
		const feature = { id: 'u1', properties: {} };
		fetchMock.mockResolvedValue(okResponse({ results: { features: [feature] } }));

		const result = await getFeatureDetailsByType(headers, type, 'u1', '7');

		expect(fetchMock).toHaveBeenCalledWith(expectedUrl, { headers });
		expect(result).toEqual(feature);
	});

	test('should look in all projects without a project id', async () => {
		fetchMock.mockResolvedValue(okResponse([{ id: 'u1', properties: {} }]));

		await getFeatureDetailsByType(headers, 'node', 'u1', '');

		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/node/?uuid=u1');
	});

	test('should fail with 404 when the feature is missing', async () => {
		fetchMock.mockResolvedValue(okResponse({ results: { features: [] } }));

		await expect(getFeatureDetailsByType(headers, 'node', 'u1', '7')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Feature not found' }
		});
	});

	test('should fail with the backend status when the request fails', async () => {
		fetchMock.mockResolvedValue(failedResponse(403, { detail: 'Forbidden' }));

		await expect(getFeatureDetailsByType(headers, 'node', 'u1', '7')).rejects.toMatchObject({
			status: 403,
			body: { message: 'Forbidden' }
		});
	});
});

describe('getTrenchesForConduit', () => {
	test('should return early when the conduit has no trenches', async () => {
		fetchMock.mockResolvedValue(okResponse({ trench_uuids: [] }));

		const result = await getTrenchesForConduit(headers, 'conduit-1');

		expect(result).toEqual({ trenches: [], trenchUuids: [] });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/conduit/conduit-1/trenches/', {
			headers
		});
	});

	test('should fetch geometry for every trench of the conduit', async () => {
		const trench = { id: 't1', properties: {} };
		fetchMock.mockImplementation((url: string) => {
			if (url.includes('/trenches/')) {
				return Promise.resolve(okResponse({ trench_uuids: ['t1', 't2'] }));
			}
			if (url.includes('uuid=t1')) {
				return Promise.resolve(okResponse({ results: { features: [trench] } }));
			}
			return Promise.resolve(okResponse({ results: { features: [] } }));
		});

		const result = await getTrenchesForConduit(headers, 'conduit-1');

		expect(result.trenchUuids).toEqual(['t1', 't2']);
		expect(result.trenches).toEqual([trench]);
	});

	test('should fail when the conduit lookup fails', async () => {
		fetchMock.mockResolvedValue(failedResponse(404, { detail: 'Not found.' }));

		await expect(getTrenchesForConduit(headers, 'conduit-1')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found.' }
		});
	});

	test('should fail when a trench geometry request fails', async () => {
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(
				url.includes('/trenches/') ? okResponse({ trench_uuids: ['t1'] }) : failedResponse(500)
			)
		);

		await expect(getTrenchesForConduit(headers, 'conduit-1')).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to fetch trenches for conduit' }
		});
	});
});
