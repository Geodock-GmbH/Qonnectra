import { beforeEach, describe, expect, test, vi } from 'vitest';

import { POST } from './+server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

describe('refresh +server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;
	/** @type {any} */
	let mockUrl;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn((name) => {
				if (name === 'api-refresh-token') return 'mock-refresh-token';
				return null;
			}),
			set: vi.fn()
		};

		mockFetch = vi.fn();
		mockUrl = { protocol: 'https:' };
	});

	test('should return 401 when no refresh token cookie exists', async () => {
		mockCookies.get = vi.fn(() => null);

		const response = await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));
		const data = await response.json();

		expect(data.success).toBe(false);
		expect(data.reason).toBe('no_refresh_token');
		expect(response.status).toBe(401);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test('should refresh token successfully', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=new-access; Path=/; HttpOnly; Secure; SameSite=Lax'
			})
		});

		const response = await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/auth/token/refresh/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Cookie: 'api-refresh-token=mock-refresh-token'
			}
		});
	});

	test('should set cookies from response headers', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie':
					'api-access-token=new-access; Path=/; HttpOnly; Secure; SameSite=Lax'
			})
		});

		await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));

		expect(mockCookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'new-access',
			expect.objectContaining({
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax'
			})
		);
	});

	test('should return 401 when refresh API fails', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			headers: new Headers()
		});

		const response = await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));
		const data = await response.json();

		expect(data.success).toBe(false);
		expect(data.reason).toBe('refresh_failed');
		expect(response.status).toBe(401);
	});

	test('should handle network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		const response = await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));
		const data = await response.json();

		expect(data.success).toBe(false);
		expect(data.reason).toBe('error');
		expect(response.status).toBe(500);
	});

	test('should handle success with no set-cookie header', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers()
		});

		const response = await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(mockCookies.set).not.toHaveBeenCalled();
	});

	test('should use https secure flag based on url protocol', async () => {
		mockUrl.protocol = 'http:';

		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=new-access; Path=/'
			})
		});

		await POST(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch, url: mockUrl }));

		expect(mockCookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'new-access',
			expect.objectContaining({
				secure: false
			})
		);
	});
});
