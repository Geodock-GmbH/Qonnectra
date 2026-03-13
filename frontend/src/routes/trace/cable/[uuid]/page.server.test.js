import { beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('trace/cable/[uuid] +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	const TEST_UUID = 'cable-uuid-789';

	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch = vi.fn();
		mockCookies = { get: vi.fn(() => 'mock-token') };
	});

	/**
	 * Creates a mock load event.
	 * @param {Record<string, string>} [searchParams] - URL search parameters
	 * @returns {any}
	 */
	function createLoadEvent(searchParams = {}) {
		const url = new URL(`http://localhost/trace/cable/${TEST_UUID}`);
		for (const [key, value] of Object.entries(searchParams)) {
			url.searchParams.set(key, value);
		}
		return {
			fetch: mockFetch,
			cookies: mockCookies,
			params: { uuid: TEST_UUID },
			url
		};
	}

	test('should call fiber-trace API with cable_id', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ cables: [] })
		});

		const result = await load(createLoadEvent());

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('fiber-trace/?cable_id=cable-uuid-789'),
			expect.objectContaining({ method: 'GET' })
		);
		expect(result.result).toEqual({ cables: [] });
		expect(result.entryType).toBe('cable');
		expect(result.entryId).toBe(TEST_UUID);
	});

	test('should append geometry params when include_geometry is true', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({})
		});

		const result = await load(
			createLoadEvent({
				include_geometry: 'true',
				geometry_mode: 'merged',
				orient_geometry: 'true'
			})
		);

		const calledUrl = mockFetch.mock.calls[0][0];
		expect(calledUrl).toContain('include_geometry=true');
		expect(calledUrl).toContain('geometry_mode=merged');
		expect(calledUrl).toContain('orient_geometry=true');
		expect(result.options).toEqual({
			includeGeometry: true,
			geometryMode: 'merged',
			orientGeometry: true
		});
	});

	test('should not append geometry params when include_geometry is false', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({})
		});

		await load(createLoadEvent());

		const calledUrl = mockFetch.mock.calls[0][0];
		expect(calledUrl).not.toContain('geometry_mode=');
	});

	test('should return error when API response is not ok', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			json: () => Promise.resolve({ error: 'Cable not found' })
		});

		const result = await load(createLoadEvent());

		expect(result.error).toBe('Cable not found');
		expect(result.entryType).toBe('cable');
		expect(result.result).toBeUndefined();
	});

	test('should return default error when API error has no body', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			json: () => Promise.reject(new Error('no json'))
		});

		const result = await load(createLoadEvent());

		expect(result.error).toBe('Trace failed');
	});

	test('should return internal server error on network failure', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		const result = await load(createLoadEvent());

		expect(result.error).toBe('Internal server error');
		expect(result.entryType).toBe('cable');
		expect(result.entryId).toBe(TEST_UUID);
	});
});
