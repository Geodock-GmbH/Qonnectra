import { beforeEach, describe, expect, test, vi } from 'vitest';

import { GET } from './+server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('address fiber-connections +server.js', () => {
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
		const mockData = {
			'unit-1': [{ id: 'fc-1', fiber: 'fiber-1' }],
			'unit-2': [{ id: 'fc-2', fiber: 'fiber-2' }]
		};

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const response = await GET(
			/** @type {any} */ ({
				cookies: mockCookies,
				fetch: mockFetch,
				params: { uuid: 'addr-uuid' }
			})
		);
		const data = await response.json();

		expect(data).toEqual(mockData);
		expect(mockFetch).toHaveBeenCalledWith(
			'http://localhost:8000/address/addr-uuid/fiber-connections/',
			expect.objectContaining({
				credentials: 'include',
				headers: { Cookie: 'api-access-token=mock-token' }
			})
		);
	});

	test('should return empty object on API error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404
		});

		const response = await GET(
			/** @type {any} */ ({
				cookies: mockCookies,
				fetch: mockFetch,
				params: { uuid: 'nonexistent' }
			})
		);
		const data = await response.json();

		expect(data).toEqual({});
		expect(response.status).toBe(404);
	});

	test('should return empty object with 500 on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const response = await GET(
			/** @type {any} */ ({
				cookies: mockCookies,
				fetch: mockFetch,
				params: { uuid: 'addr-uuid' }
			})
		);
		const data = await response.json();

		expect(data).toEqual({});
		expect(response.status).toBe(500);
	});
});
