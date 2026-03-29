import { beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(),
	getSurfaces: vi.fn(),
	getConstructionTypes: vi.fn(),
	getAreaTypes: vi.fn()
}));

describe('settings +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		mockCookies = {
			get: vi.fn(() => 'mock-token')
		};
	});

	test('should load all attribute data in parallel', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		/** @type {any} */ (getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [{ uuid: 'nt-1', name: 'MFG' }],
			nodeTypesError: null
		});
		/** @type {any} */ (getSurfaces).mockResolvedValueOnce({
			surfaces: [{ uuid: 's-1', name: 'Asphalt' }],
			surfacesError: null
		});
		/** @type {any} */ (getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
			constructionTypesError: null
		});
		/** @type {any} */ (getAreaTypes).mockResolvedValueOnce({
			areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
			areaTypesError: null
		});

		const result = await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

		expect(result).toEqual({
			nodeTypes: [{ uuid: 'nt-1', name: 'MFG' }],
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
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		/** @type {any} */ (getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [],
			nodeTypesError: null
		});
		/** @type {any} */ (getSurfaces).mockResolvedValueOnce({ surfaces: [], surfacesError: null });
		/** @type {any} */ (getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: null
		});
		/** @type {any} */ (getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: null
		});

		await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

		expect(getNodeTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
		expect(getSurfaces).toHaveBeenCalledWith(mockFetch, mockCookies);
		expect(getConstructionTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
		expect(getAreaTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
	});

	test('should propagate errors from attribute functions', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		/** @type {any} */ (getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [],
			nodeTypesError: 'Failed to load node types'
		});
		/** @type {any} */ (getSurfaces).mockResolvedValueOnce({ surfaces: [], surfacesError: null });
		/** @type {any} */ (getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: null
		});
		/** @type {any} */ (getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: null
		});

		/** @type {any} */
		const result = await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

		expect(result.nodeTypesError).toBe('Failed to load node types');
		expect(result.nodeTypes).toEqual([]);
	});

	test('should handle all attribute functions returning errors', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		/** @type {any} */ (getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [],
			nodeTypesError: 'Error 1'
		});
		/** @type {any} */ (getSurfaces).mockResolvedValueOnce({
			surfaces: [],
			surfacesError: 'Error 2'
		});
		/** @type {any} */ (getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: 'Error 3'
		});
		/** @type {any} */ (getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: 'Error 4'
		});

		/** @type {any} */
		const result = await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

		expect(result.nodeTypesError).toBe('Error 1');
		expect(result.surfacesError).toBe('Error 2');
		expect(result.constructionTypesError).toBe('Error 3');
		expect(result.areaTypesError).toBe('Error 4');
	});

	test('should merge all attribute data into a single object', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		/** @type {any} */ (getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [
				{ uuid: 'nt-1', name: 'MFG' },
				{ uuid: 'nt-2', name: 'KVZ' }
			],
			nodeTypesError: null
		});
		/** @type {any} */ (getSurfaces).mockResolvedValueOnce({
			surfaces: [
				{ uuid: 's-1', name: 'Asphalt' },
				{ uuid: 's-2', name: 'Gravel' }
			],
			surfacesError: null
		});
		/** @type {any} */ (getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: null
		});
		/** @type {any} */ (getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: null
		});

		/** @type {any} */
		const result = await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

		expect(result.nodeTypes).toHaveLength(2);
		expect(result.surfaces).toHaveLength(2);
		expect(result.constructionTypes).toHaveLength(0);
		expect(result.areaTypes).toHaveLength(0);
	});
});
