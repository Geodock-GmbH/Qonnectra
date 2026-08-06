import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getLayerExtent } from '$lib/server/featureSearch';

import { actions, load } from './+page.server';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
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

vi.mock('$lib/server/featureSearch', () => ({
	getLayerExtent: vi.fn(() => Promise.resolve({ extent: [1, 2, 3, 4], layer: 'trench' }))
}));

function makeCookies(values: Record<string, string> = {}): Cookies {
	return { get: (name: string) => values[name] } as unknown as Cookies;
}

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
	test('should load areas and rates for the selected project', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('area/')) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							results: {
								features: [
									{
										id: 'area-1',
										properties: { name: 'Süd', area_type: { area_type: 'Ausbau' } },
										geometry: { type: 'Polygon' }
									}
								]
							}
						})
				});
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ results: [{ id: 1, rate: 100 }] })
			});
		});

		const result = (await load({
			fetch: fetchMock,
			cookies: makeCookies({ 'selected-project': '7' })
		} as never)) as Record<string, unknown>;

		expect(result.projectId).toBe('7');
		expect(result.areas).toEqual([
			{ uuid: 'area-1', name: 'Süd', areaType: 'Ausbau', geom: { type: 'Polygon' } }
		]);
		expect(result.rates).toEqual([{ id: 1, rate: 100 }]);
		expect(fetchMock.mock.calls[0][0]).toContain('project=7');
	});

	test('should default to project 1 and tolerate failing endpoints', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = (await load({ fetch: fetchMock, cookies: makeCookies() } as never)) as Record<
			string,
			unknown
		>;

		expect(result.projectId).toBe('1');
		expect(result.areas).toEqual([]);
		expect(result.rates).toEqual([]);
	});
});

describe('calculate action', () => {
	test('should post the valuation payload with optional parameters', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ total: 12345 })
		});

		const result = await actions.calculate({
			request: makeRequest({
				project: '7',
				areaUuids: '["area-1"]',
				baseYear: '2020',
				annualCorrection: '0.02'
			}),
			fetch: fetchMock,
			cookies: makeCookies()
		} as never);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({
			project: 7,
			area_uuids: ['area-1'],
			base_year: 2020,
			annual_correction: 0.02
		});
		expect(result).toEqual({ success: true, result: { total: 12345 } });
	});

	test('should omit optional parameters when empty', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({})
		});

		await actions.calculate({
			request: makeRequest({ project: '7', areaUuids: '[]', baseYear: '', annualCorrection: '' }),
			fetch: fetchMock,
			cookies: makeCookies()
		} as never);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({ project: 7, area_uuids: [] });
	});

	test('should fail without a project', async () => {
		const result = await actions.calculate({
			request: makeRequest({ areaUuids: '[]' }),
			fetch: vi.fn(),
			cookies: makeCookies()
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});

	test('should fail on malformed area selections', async () => {
		const result = await actions.calculate({
			request: makeRequest({ project: '7', areaUuids: '{broken' }),
			fetch: vi.fn(),
			cookies: makeCookies()
		} as never);

		expect(result).toEqual({ status: 400, data: { message: 'Invalid area selection' } });
	});

	test('should surface backend error details', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 422,
			json: () => Promise.resolve({ detail: 'Keine Kostensätze gepflegt' })
		});

		const result = await actions.calculate({
			request: makeRequest({ project: '7', areaUuids: '[]' }),
			fetch: fetchMock,
			cookies: makeCookies()
		} as never);

		expect(result).toEqual({ status: 422, data: { message: 'Keine Kostensätze gepflegt' } });
	});
});

describe('getLayerExtent action', () => {
	test('should delegate to the shared layer extent helper', async () => {
		const result = await actions.getLayerExtent({
			request: makeRequest({ layerType: 'trench', projectId: '7' }),
			fetch: vi.fn(),
			cookies: makeCookies()
		} as never);

		expect(getLayerExtent).toHaveBeenCalledWith(
			expect.any(Function),
			expect.anything(),
			'trench',
			'7'
		);
		expect(result).toEqual({ extent: [1, 2, 3, 4], layer: 'trench' });
	});
});
