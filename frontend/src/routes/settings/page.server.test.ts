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
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: { get: ReturnType<typeof vi.fn> };

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

		vi.mocked(getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [{ id: 1, node_type: 'MFG' }],
			nodeTypesError: null
		});
		vi.mocked(getSurfaces).mockResolvedValueOnce({
			surfaces: [{ id: 1, surface: 'Asphalt' }],
			surfacesError: null
		});
		vi.mocked(getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [{ id: 1, construction_type: 'Open' }],
			constructionTypesError: null
		});
		vi.mocked(getAreaTypes).mockResolvedValueOnce({
			areaTypes: [{ id: 1, area_type: 'Residential' }],
			areaTypesError: null
		});

		const result = await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
			typeof load
		>[0]);

		expect(result).toEqual({
			nodeTypes: [{ id: 1, node_type: 'MFG' }],
			nodeTypesError: null,
			surfaces: [{ id: 1, surface: 'Asphalt' }],
			surfacesError: null,
			constructionTypes: [{ id: 1, construction_type: 'Open' }],
			constructionTypesError: null,
			areaTypes: [{ id: 1, area_type: 'Residential' }],
			areaTypesError: null
		});
	});

	test('should pass fetch and cookies to all attribute functions', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		vi.mocked(getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [],
			nodeTypesError: null
		});
		vi.mocked(getSurfaces).mockResolvedValueOnce({ surfaces: [], surfacesError: null });
		vi.mocked(getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: null
		});
		vi.mocked(getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: null
		});

		await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<typeof load>[0]);

		expect(getNodeTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
		expect(getSurfaces).toHaveBeenCalledWith(mockFetch, mockCookies);
		expect(getConstructionTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
		expect(getAreaTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
	});

	test('should propagate errors from attribute functions', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		vi.mocked(getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [],
			nodeTypesError: 'Failed to load node types'
		});
		vi.mocked(getSurfaces).mockResolvedValueOnce({ surfaces: [], surfacesError: null });
		vi.mocked(getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: null
		});
		vi.mocked(getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: null
		});

		const result = (await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
			typeof load
		>[0])) as Record<string, unknown>;

		expect(result.nodeTypesError).toBe('Failed to load node types');
		expect(result.nodeTypes).toEqual([]);
	});

	test('should handle all attribute functions returning errors', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		vi.mocked(getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [],
			nodeTypesError: 'Error 1'
		});
		vi.mocked(getSurfaces).mockResolvedValueOnce({
			surfaces: [],
			surfacesError: 'Error 2'
		});
		vi.mocked(getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: 'Error 3'
		});
		vi.mocked(getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: 'Error 4'
		});

		const result = (await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
			typeof load
		>[0])) as Record<string, unknown>;

		expect(result.nodeTypesError).toBe('Error 1');
		expect(result.surfacesError).toBe('Error 2');
		expect(result.constructionTypesError).toBe('Error 3');
		expect(result.areaTypesError).toBe('Error 4');
	});

	test('should merge all attribute data into a single object', async () => {
		const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
			await import('$lib/server/attributes');

		vi.mocked(getNodeTypes).mockResolvedValueOnce({
			nodeTypes: [
				{ id: 1, node_type: 'MFG' },
				{ id: 2, node_type: 'KVZ' }
			],
			nodeTypesError: null
		});
		vi.mocked(getSurfaces).mockResolvedValueOnce({
			surfaces: [
				{ id: 1, surface: 'Asphalt' },
				{ id: 2, surface: 'Gravel' }
			],
			surfacesError: null
		});
		vi.mocked(getConstructionTypes).mockResolvedValueOnce({
			constructionTypes: [],
			constructionTypesError: null
		});
		vi.mocked(getAreaTypes).mockResolvedValueOnce({
			areaTypes: [],
			areaTypesError: null
		});

		const result = (await load({ fetch: mockFetch, cookies: mockCookies } as unknown as Parameters<
			typeof load
		>[0])) as Record<string, unknown>;

		expect(result.nodeTypes).toHaveLength(2);
		expect(result.surfaces).toHaveLength(2);
		expect(result.constructionTypes).toHaveLength(0);
		expect(result.areaTypes).toHaveLength(0);
	});
});
