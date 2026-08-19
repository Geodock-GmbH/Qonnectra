import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAreaTypes, getConstructionTypes, getNodeTypes, getSurfaces } from './attributes';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Cookie: 'api-access-token=mock-token' })
}));

const mockCookies = {} as Cookies;
const types = [{ uuid: 'u1', name: 'Type A', color: '#ff0000' }];

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('attribute fetchers', () => {
	const cases = [
		['getNodeTypes', getNodeTypes, 'attributes_node_type/', 'nodeTypes', 'nodeTypesError'],
		['getSurfaces', getSurfaces, 'attributes_surface/', 'surfaces', 'surfacesError'],
		[
			'getConstructionTypes',
			getConstructionTypes,
			'attributes_construction_type/',
			'constructionTypes',
			'constructionTypesError'
		],
		['getAreaTypes', getAreaTypes, 'attributes_area_type/', 'areaTypes', 'areaTypesError']
	] as const;

	test.each(cases)(
		'%s should return fetched types',
		async (_name, fetcher, path, dataKey, errorKey) => {
			const fetchMock = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(types)
			});

			const result = await fetcher(fetchMock, mockCookies);

			expect(fetchMock).toHaveBeenCalledWith(`http://localhost:8000/${path}`, {
				credentials: 'include',
				headers: { Cookie: 'api-access-token=mock-token' }
			});
			expect((result as Record<string, unknown>)[dataKey]).toEqual(types);
			expect((result as Record<string, unknown>)[errorKey]).toBeNull();
		}
	);

	test.each(cases)(
		'%s should return an error message on a failed response',
		async (_name, fetcher, _path, dataKey, errorKey) => {
			const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

			const result = await fetcher(fetchMock, mockCookies);

			expect((result as Record<string, unknown>)[dataKey]).toEqual([]);
			expect((result as Record<string, unknown>)[errorKey]).toMatch(/Failed to load/);
		}
	);

	test.each(cases)(
		'%s should return the error message on a network failure',
		async (_name, fetcher, _path, dataKey, errorKey) => {
			const fetchMock = vi.fn().mockRejectedValue(new Error('backend down'));

			const result = await fetcher(fetchMock, mockCookies);

			expect((result as Record<string, unknown>)[dataKey]).toEqual([]);
			expect((result as Record<string, unknown>)[errorKey]).toBe('backend down');
		}
	);
});
