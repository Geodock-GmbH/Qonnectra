import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	clearContentTypeCache,
	fetchContentTypes,
	getContentTypeId,
	isSupportedFeatureType
} from './contentTypes';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

const fetchMock = vi.fn();

function mockContentTypesResponse(types: Array<{ model: string; id: number }>) {
	fetchMock.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve(types)
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	clearContentTypeCache();
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe('fetchContentTypes', () => {
	test('should fetch content types and return a model-to-id mapping', async () => {
		mockContentTypesResponse([
			{ model: 'node', id: 12 },
			{ model: 'trench', id: 7 }
		]);

		const mapping = await fetchContentTypes();

		expect(fetchMock).toHaveBeenCalledWith('http://mock-api.test/content-types/', {
			credentials: 'include'
		});
		expect(mapping).toEqual({ node: 12, trench: 7 });
	});

	test('should cache the mapping and not fetch again', async () => {
		mockContentTypesResponse([{ model: 'node', id: 12 }]);

		await fetchContentTypes();
		await fetchContentTypes();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test('should deduplicate concurrent requests into one fetch', async () => {
		mockContentTypesResponse([{ model: 'node', id: 12 }]);

		const [first, second] = await Promise.all([fetchContentTypes(), fetchContentTypes()]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(first).toEqual(second);
	});

	test('should throw on a non-ok response and allow retrying', async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

		await expect(fetchContentTypes()).rejects.toThrow('Failed to fetch content types: 500');

		mockContentTypesResponse([{ model: 'cable', id: 3 }]);
		await expect(fetchContentTypes()).resolves.toEqual({ cable: 3 });
	});
});

describe('getContentTypeId', () => {
	test('should return null and warn when the cache is not loaded', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(getContentTypeId('node')).toBeNull();
		expect(warnSpy).toHaveBeenCalled();
	});

	test('should return the cached id for a known feature type', async () => {
		mockContentTypesResponse([{ model: 'node', id: 12 }]);
		await fetchContentTypes();

		expect(getContentTypeId('node')).toBe(12);
	});

	test('should return null for an unknown feature type', async () => {
		mockContentTypesResponse([{ model: 'node', id: 12 }]);
		await fetchContentTypes();

		expect(getContentTypeId('spaceship')).toBeNull();
	});
});

describe('isSupportedFeatureType', () => {
	test('should return false when the cache is not loaded', () => {
		expect(isSupportedFeatureType('node')).toBe(false);
	});

	test('should reflect cache contents once loaded', async () => {
		mockContentTypesResponse([{ model: 'node', id: 12 }]);
		await fetchContentTypes();

		expect(isSupportedFeatureType('node')).toBe(true);
		expect(isSupportedFeatureType('spaceship')).toBe(false);
	});
});
