import { beforeEach, describe, expect, test, vi } from 'vitest';

import { GET } from './+server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('residential-unit fiber-connections +server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch = vi.fn();
		mockCookies = {
			get: vi.fn((name) => {
				if (name === 'api-access-token') return 'mock-token';
				return null;
			})
		};
	});

	test('should fetch fiber connections successfully', async () => {
		const mockData = [
			{ id: 'fc-1', fiber: 'fiber-1' },
			{ id: 'fc-2', fiber: 'fiber-2' }
		];

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const response = await GET(
			/** @type {any} */ ({
				cookies: mockCookies,
				fetch: mockFetch,
				params: { unitUuid: 'unit-uuid' }
			})
		);
		const data = await response.json();

		expect(data).toEqual(mockData);
		expect(mockFetch).toHaveBeenCalledWith(
			'http://localhost:8000/residential-unit/unit-uuid/fiber-connections/',
			expect.objectContaining({
				credentials: 'include',
				headers: { Cookie: 'api-access-token=mock-token' }
			})
		);
	});

	test('should return empty array on API error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 403
		});

		const response = await GET(
			/** @type {any} */ ({
				cookies: mockCookies,
				fetch: mockFetch,
				params: { unitUuid: 'forbidden-uuid' }
			})
		);
		const data = await response.json();

		expect(data).toEqual([]);
		expect(response.status).toBe(403);
	});

	test('should return empty array with 500 on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const response = await GET(
			/** @type {any} */ ({
				cookies: mockCookies,
				fetch: mockFetch,
				params: { unitUuid: 'unit-uuid' }
			})
		);
		const data = await response.json();

		expect(data).toEqual([]);
		expect(response.status).toBe(500);
	});
});
