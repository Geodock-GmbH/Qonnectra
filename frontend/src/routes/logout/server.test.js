import { beforeEach, describe, expect, test, vi } from 'vitest';

import { POST } from './+server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('set-cookie-parser', () => ({
	default: {
		parse: vi.fn((header) => {
			if (!header) return [];
			return header.split(',').map((/** @type {string} */ part) => {
				const [nameValue, ...attrs] = part.trim().split(';');
				const [name, value] = nameValue.split('=');
				/** @type {Record<string, any>} */
				const cookie = { name: name.trim(), value: value.trim() };
				attrs.forEach((/** @type {string} */ attr) => {
					const [key, val] = attr.trim().split('=');
					const k = key.toLowerCase();
					if (k === 'path') cookie.path = val;
					if (k === 'httponly') cookie.httpOnly = true;
					if (k === 'secure') cookie.secure = true;
					if (k === 'samesite') cookie.sameSite = val;
				});
				return cookie;
			});
		})
	}
}));

describe('logout +server.js', () => {
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
				if (name === 'csrftoken') return 'mock-csrf-token';
				if (name === 'api-access-token') return 'mock-access-token';
				return null;
			}),
			set: vi.fn(),
			delete: vi.fn()
		};

		mockFetch = vi.fn();
		mockUrl = { protocol: 'https:' };
	});

	/**
	 * Creates a mock SvelteKit request event for the logout endpoint.
	 * @returns {any}
	 */
	function createEvent() {
		return {
			cookies: mockCookies,
			fetch: mockFetch,
			url: mockUrl
		};
	}

	test('should redirect to /login after successful logout', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: () => Promise.resolve('')
		});

		await expect(POST(createEvent())).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	test('should call backend logout API with correct headers', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: () => Promise.resolve('')
		});

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/auth/logout/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': 'mock-csrf-token',
				Cookie: 'api-refresh-token=mock-refresh-token'
			},
			credentials: 'include'
		});
	});

	test('should delete access and refresh token cookies', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: () => Promise.resolve('')
		});

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockCookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
		expect(mockCookies.delete).toHaveBeenCalledWith('api-refresh-token', { path: '/' });
	});

	test('should set cookies from backend response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({
				'set-cookie': 'api-access-token=; Path=/; HttpOnly; Secure; SameSite=Lax'
			}),
			text: () => Promise.resolve('')
		});

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockCookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'',
			expect.objectContaining({ path: '/' })
		);
	});

	test('should omit X-CSRFToken header when no csrf cookie exists', async () => {
		mockCookies.get = vi.fn((name) => {
			if (name === 'api-refresh-token') return 'mock-refresh-token';
			return null;
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: () => Promise.resolve('')
		});

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		const callHeaders = mockFetch.mock.calls[0][1].headers;
		expect(callHeaders['X-CSRFToken']).toBeUndefined();
	});

	test('should omit Cookie header when no refresh token exists', async () => {
		mockCookies.get = vi.fn(() => null);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: () => Promise.resolve('')
		});

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		const callHeaders = mockFetch.mock.calls[0][1].headers;
		expect(callHeaders['Cookie']).toBeUndefined();
	});

	test('should still redirect on backend API failure', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			headers: new Headers(),
			text: () => Promise.resolve('Internal Server Error')
		});

		await expect(POST(createEvent())).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	test('should still redirect on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		await expect(POST(createEvent())).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	test('should still delete cookies on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockCookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
		expect(mockCookies.delete).toHaveBeenCalledWith('api-refresh-token', { path: '/' });
	});

	test('should use https secure flag based on url protocol', async () => {
		mockUrl.protocol = 'http:';

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({
				'set-cookie': 'api-access-token=; Path=/'
			}),
			text: () => Promise.resolve('')
		});

		try {
			await POST(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockCookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'',
			expect.objectContaining({
				secure: false
			})
		);
	});
});
