import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	buildRoutingBody,
	fetchTrenchFeature,
	mapRouteResult,
	pickTrenchFeature,
	requestRoute
} from './routing-data';

vi.mock('$env/static/private', () => ({ API_URL: 'http://api.test/' }));

const headers = { Cookie: 'api-access-token=token' };
const fetchMock = vi.fn();

const routeInput = {
	startTrenchId: 'T-1',
	endTrenchId: 'T-3',
	projectId: '7',
	tolerance: 2.5
};

const backendRoute = {
	path_geometry_wkt: 'LINESTRING(0 0, 1 1)',
	traversed_trench_uuids: ['uuid-1', 'uuid-2'],
	traversed_trench_ids: ['T-1', 'T-2']
};

/**
 * Builds a minimal fetch response.
 * @param body - Parsed JSON body.
 * @param status - HTTP status.
 */
function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body)
	} as Response;
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

describe('buildRoutingBody', () => {
	test('wraps project and tolerance in the arrays the backend indexes into', () => {
		expect(buildRoutingBody(routeInput)).toEqual({
			start_trench_id: 'T-1',
			end_trench_id: 'T-3',
			project_id: [7],
			tolerance: [2.5]
		});
	});
});

describe('mapRouteResult', () => {
	test('pairs each traversed trench uuid with its label', () => {
		expect(mapRouteResult(backendRoute)).toEqual({
			pathWkt: 'LINESTRING(0 0, 1 1)',
			trenches: [
				{ uuid: 'uuid-1', label: 'T-1' },
				{ uuid: 'uuid-2', label: 'T-2' }
			]
		});
	});

	test('returns null when the route has no geometry', () => {
		expect(mapRouteResult({ traversed_trench_uuids: ['uuid-1'] })).toBeNull();
	});

	test('returns null when no trench was traversed', () => {
		expect(mapRouteResult({ path_geometry_wkt: 'LINESTRING(0 0, 1 1)' })).toBeNull();
	});
});

describe('requestRoute', () => {
	test('posts the routing request and maps the route', async () => {
		fetchMock.mockResolvedValue(jsonResponse(backendRoute));

		const route = await requestRoute(headers, routeInput);

		expect(fetchMock).toHaveBeenCalledWith('http://api.test/routing/', {
			method: 'POST',
			headers,
			body: JSON.stringify(buildRoutingBody(routeInput))
		});
		expect(route.trenches).toHaveLength(2);
	});

	test('surfaces the backend’s routing error with its status', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'Start trench not found' }, 404));

		await expect(requestRoute(headers, routeInput)).rejects.toMatchObject({
			status: 404,
			body: { message: 'Start trench not found' }
		});
	});

	test('reports a route without geometry as not found', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ traversed_trench_uuids: [] }));

		await expect(requestRoute(headers, routeInput)).rejects.toMatchObject({ status: 404 });
	});
});

describe('pickTrenchFeature', () => {
	const geometry = {
		type: 'LineString',
		coordinates: [
			[0, 0],
			[1, 1]
		]
	};

	test('reads the first feature of a paginated feature collection', () => {
		const body = { count: 1, results: { type: 'FeatureCollection', features: [{ geometry }] } };

		expect(pickTrenchFeature(body)).toEqual({ type: 'Feature', geometry });
	});

	test('reads an unpaginated feature collection', () => {
		expect(pickTrenchFeature({ type: 'FeatureCollection', features: [{ geometry }] })).toEqual({
			type: 'Feature',
			geometry
		});
	});

	test('returns null when no trench matched', () => {
		expect(pickTrenchFeature({ results: { features: [] } })).toBeNull();
	});

	test('returns null for a feature without geometry', () => {
		expect(pickTrenchFeature({ results: { features: [{ geometry: null }] } })).toBeNull();
	});
});

describe('fetchTrenchFeature', () => {
	test('looks the trench up by uuid', async () => {
		const geometry = { type: 'LineString', coordinates: [] };
		fetchMock.mockResolvedValue(jsonResponse({ results: { features: [{ geometry }] } }));

		const feature = await fetchTrenchFeature(headers, 'trench 1');

		expect(fetchMock).toHaveBeenCalledWith('http://api.test/trench/?uuid=trench%201', { headers });
		expect(feature).toEqual({ type: 'Feature', geometry });
	});

	test('raises a 404 when the trench does not exist', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ results: { features: [] } }));

		await expect(fetchTrenchFeature(headers, 'trench-1')).rejects.toMatchObject({ status: 404 });
	});

	test('raises an HttpError when the backend request fails', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'Boom' }, 500));

		await expect(fetchTrenchFeature(headers, 'trench-1')).rejects.toMatchObject({
			status: 500,
			body: { message: 'Boom' }
		});
	});
});
