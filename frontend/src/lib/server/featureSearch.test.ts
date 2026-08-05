import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	getFeatureDetailsByType,
	getLayerExtent,
	getTrenchUuidsForConduit,
	searchFeaturesInProject
} from './featureSearch';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		const httpError = new Error(message) as Error & { status: number };
		httpError.status = status;
		throw httpError;
	}
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Cookie: 'api-access-token=mock-token' })
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

const mockCookies = {} as Cookies;

function okResponse(data: unknown) {
	return { ok: true, json: () => Promise.resolve(data) };
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('searchFeaturesInProject', () => {
	test('should throw 400 without a search query', async () => {
		await expect(searchFeaturesInProject(vi.fn(), mockCookies, '', '1')).rejects.toMatchObject({
			status: 400
		});
	});

	test('should aggregate results from all feature endpoints', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('address/all/')) {
				return Promise.resolve(
					okResponse({
						features: [
							{
								id: 'addr-1',
								properties: { street: 'Hauptstraße', housenumber: '5', house_number_suffix: 'a' }
							}
						]
					})
				);
			}
			if (url.includes('node/all/')) {
				return Promise.resolve(
					okResponse({ features: [{ id: 'node-1', properties: { name: 'PoP-1' } }] })
				);
			}
			if (url.includes('trench/all/')) {
				return Promise.resolve(
					okResponse({ features: [{ id: 'trench-1', properties: { id_trench: 'T-42' } }] })
				);
			}
			if (url.includes('conduit/all/')) {
				return Promise.resolve(
					okResponse({ results: [{ uuid: 'conduit-1', name: 'C-1', conduit_type: 'DA 50' }] })
				);
			}
			return Promise.resolve(
				okResponse({ features: [{ id: 'area-1', properties: { name: 'Süd' } }] })
			);
		});

		const results = await searchFeaturesInProject(fetchMock, mockCookies, 'haupt', '7');

		expect(fetchMock).toHaveBeenCalledTimes(5);
		expect(fetchMock.mock.calls[0][0]).toBe(
			'http://localhost:8000/address/all/?search=haupt&project=7'
		);
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

	test('should support non-GeoJSON address results and skip incomplete features', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('address/all/')) {
				return Promise.resolve(
					okResponse({ results: [{ uuid: 'addr-2', street: 'Dorfweg', housenumber: '3' }] })
				);
			}
			if (url.includes('node/all/')) {
				return Promise.resolve(okResponse({ features: [{ id: 'node-1', properties: {} }] }));
			}
			if (url.includes('conduit/all/')) {
				return Promise.resolve(okResponse({ results: [] }));
			}
			return Promise.resolve(okResponse({ features: [] }));
		});

		const results = await searchFeaturesInProject(fetchMock, mockCookies, 'dorf', '');

		expect(results).toEqual([
			{ value: 'addr-2', label: 'Dorfweg 3 (Adresse)', type: 'address', uuid: 'addr-2' }
		]);
	});

	test('should throw 500 when any endpoint fails', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('node/all/')) {
				return Promise.resolve({ ok: false, status: 500 });
			}
			return Promise.resolve(okResponse({ features: [] }));
		});

		await expect(
			searchFeaturesInProject(fetchMock, mockCookies, 'haupt', '7')
		).rejects.toMatchObject({ status: 500, message: 'Failed to search features' });
	});
});

describe('getFeatureDetailsByType', () => {
	test('should throw 400 without type or uuid', async () => {
		await expect(
			getFeatureDetailsByType(vi.fn(), mockCookies, 'node', '', '1')
		).rejects.toMatchObject({ status: 400 });
	});

	test.each([
		['node', 'http://localhost:8000/node/?uuid=u1&project=7'],
		['trench', 'http://localhost:8000/trench/?uuid=u1&project=7'],
		['address', 'http://localhost:8000/address/?uuid=u1&project=7'],
		['area', 'http://localhost:8000/area/?uuid=u1&project=7']
	] as const)('should fetch %s details from the right endpoint', async (type, expectedUrl) => {
		const feature = { id: 'u1', properties: {} };
		const fetchMock = vi.fn().mockResolvedValue(okResponse([feature]));

		const result = await getFeatureDetailsByType(fetchMock, mockCookies, type, 'u1', '7');

		expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.anything());
		expect(result).toEqual({ success: true, feature });
	});

	test('should unwrap GeoJSON result collections', async () => {
		const features = [{ id: 'u1', properties: {} }];
		const fetchMock = vi.fn().mockResolvedValue(okResponse({ results: { features } }));

		const result = await getFeatureDetailsByType(fetchMock, mockCookies, 'node', 'u1', '7');

		expect(result.feature).toEqual(features);
	});

	test('should throw 500 when the feature is missing', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okResponse([]));

		await expect(
			getFeatureDetailsByType(fetchMock, mockCookies, 'node', 'u1', '7')
		).rejects.toMatchObject({ status: 500 });
	});
});

describe('getTrenchUuidsForConduit', () => {
	test('should throw 400 without a conduit uuid', async () => {
		await expect(getTrenchUuidsForConduit(vi.fn(), mockCookies, '')).rejects.toMatchObject({
			status: 400
		});
	});

	test('should return early when the conduit has no trenches', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okResponse({ trench_uuids: [] }));

		const result = await getTrenchUuidsForConduit(fetchMock, mockCookies, 'conduit-1');

		expect(result).toEqual({ success: true, trenches: [], trenchUuids: [] });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test('should fetch geometry for every trench of the conduit', async () => {
		const trench = { id: 't1', properties: {} };
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('/trenches/')) {
				return Promise.resolve(okResponse({ trench_uuids: ['t1', 't2'] }));
			}
			if (url.includes('uuid=t1')) {
				return Promise.resolve(okResponse({ results: { features: [trench] } }));
			}
			return Promise.resolve(okResponse({ results: { features: [] } }));
		});

		const result = await getTrenchUuidsForConduit(fetchMock, mockCookies, 'conduit-1');

		expect(result.trenchUuids).toEqual(['t1', 't2']);
		expect(result.trenches).toEqual([trench]);
	});
});

describe('getLayerExtent', () => {
	test('should throw 400 without layer type or project', async () => {
		await expect(getLayerExtent(vi.fn(), mockCookies, 'trench', '')).rejects.toMatchObject({
			status: 400
		});
	});

	test('should fetch the extent for a layer', async () => {
		const extentResponse = { extent: [1, 2, 3, 4], layer: 'trench' };
		const fetchMock = vi.fn().mockResolvedValue(okResponse(extentResponse));

		const result = await getLayerExtent(fetchMock, mockCookies, 'trench', '7');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/layer-extent/?layer=trench&project=7',
			expect.anything()
		);
		expect(result).toEqual(extentResponse);
	});

	test('should throw 500 when the backend fails', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502 });

		await expect(getLayerExtent(fetchMock, mockCookies, 'trench', '7')).rejects.toMatchObject({
			status: 500
		});
	});
});
