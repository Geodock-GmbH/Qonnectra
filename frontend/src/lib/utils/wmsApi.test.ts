import { invalidateAll } from '$app/navigation';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchWMSAccessToken, fetchWMSSources, getWMSProxyUrl, refreshWMSLayers } from './wmsApi';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn(() => Promise.resolve())
}));

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	vi.mocked(invalidateAll).mockClear();
});

describe('fetchWMSSources', () => {
	test('should fetch sources for a project', async () => {
		const sources = [{ id: 's1', name: 'DOP', layers: [] }];
		fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(sources) });

		const result = await fetchWMSSources('proj-1');

		expect(fetchMock).toHaveBeenCalledWith('http://mock-api.test/wms-sources/?project=proj-1', {
			credentials: 'include'
		});
		expect(result).toEqual(sources);
	});

	test('should refresh the session and retry once on 401', async () => {
		const sources = [{ id: 's1' }];
		fetchMock
			.mockResolvedValueOnce({ ok: false, status: 401 })
			.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(sources) });

		const result = await fetchWMSSources('proj-1');

		expect(invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result).toEqual(sources);
	});

	test('should throw when the retry after 401 also fails', async () => {
		fetchMock
			.mockResolvedValueOnce({ ok: false, status: 401 })
			.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });

		await expect(fetchWMSSources('proj-1')).rejects.toThrow(
			'Failed to fetch WMS sources: Unauthorized'
		);
	});

	test('should throw on other error responses without retrying', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

		await expect(fetchWMSSources('proj-1')).rejects.toThrow(
			'Failed to fetch WMS sources: Server Error'
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('refreshWMSLayers', () => {
	test('should POST to the refresh endpoint and return the updated source', async () => {
		const source = { id: 's1', layers: [{ id: 'l1' }] };
		fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(source) });

		const result = await refreshWMSLayers('s1');

		expect(fetchMock).toHaveBeenCalledWith('http://mock-api.test/wms-sources/s1/refresh_layers/', {
			method: 'POST',
			credentials: 'include'
		});
		expect(result).toEqual(source);
	});

	test('should surface the backend error message on failure', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			statusText: 'Bad Request',
			json: () => Promise.resolve({ error: 'Capabilities unreachable' })
		});

		await expect(refreshWMSLayers('s1')).rejects.toThrow('Capabilities unreachable');
	});

	test('should fall back to a generic message when the error body is not JSON', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			statusText: 'Bad Gateway',
			json: () => Promise.reject(new Error('not json'))
		});

		await expect(refreshWMSLayers('s1')).rejects.toThrow(
			'Failed to refresh WMS layers: Bad Gateway'
		);
	});
});

describe('getWMSProxyUrl', () => {
	test('should build the proxy URL without a token', () => {
		expect(getWMSProxyUrl('s1')).toBe('http://mock-api.test/wms-proxy/s1/');
	});

	test('should append the token URL-encoded', () => {
		expect(getWMSProxyUrl('s1', 'a+b/c')).toBe(
			'http://mock-api.test/wms-proxy/s1/?token=a%2Bb%2Fc'
		);
	});
});

describe('fetchWMSAccessToken', () => {
	test('should return the token from the access token endpoint', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ token: 'wms-tok' })
		});

		await expect(fetchWMSAccessToken()).resolves.toBe('wms-tok');
	});

	test('should refresh the session and retry once on 401', async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ token: 'fresh-tok' })
		});

		await expect(fetchWMSAccessToken()).resolves.toBe('fresh-tok');
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});

	test('should throw with the response status attached when the retry fails', async () => {
		fetchMock
			.mockResolvedValueOnce({ ok: false, status: 401 })
			.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });

		await expect(fetchWMSAccessToken()).rejects.toMatchObject({
			message: 'Failed to fetch WMS access token: Forbidden',
			status: 403
		});
	});

	test('should throw with the status attached on other errors', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

		await expect(fetchWMSAccessToken()).rejects.toMatchObject({
			message: 'Failed to fetch WMS access token: Server Error',
			status: 500
		});
	});
});
