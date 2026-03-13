import { beforeEach, describe, expect, test, vi } from 'vitest';

import { actions } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('set-cookie-parser', () => ({
	default: {
		parse: vi.fn((response) => {
			const header = response.headers?.get('set-cookie');
			if (!header) return [];
			return header.split(',').map((/** @type {string} */ part) => {
				const [nameValue, ...attrs] = part.trim().split(';');
				const [name, value] = nameValue.split('=');
				const cookie = { name: name.trim(), value: value.trim() };
				attrs.forEach((/** @type {string} */ attr) => {
					const [key, val] = attr.trim().split('=');
					const k = key.toLowerCase();
					if (k === 'path') /** @type {any} */ (cookie).path = val;
					if (k === 'httponly') /** @type {any} */ (cookie).httpOnly = true;
					if (k === 'secure') /** @type {any} */ (cookie).secure = true;
					if (k === 'samesite') /** @type {any} */ (cookie).sameSite = val;
				});
				return cookie;
			});
		})
	}
}));

describe('login +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;
	/** @type {any} */
	let mockUrl;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn(() => null),
			set: vi.fn()
		};

		mockFetch = vi.fn();
		mockUrl = { protocol: 'https:' };
	});

	/**
	 * Creates a mock FormData with login credentials.
	 * @param {object} [options]
	 * @param {string} [options.username]
	 * @param {string} [options.password]
	 * @param {string} [options.redirectTo]
	 * @returns {FormData}
	 */
	function createFormData({ username = 'testuser', password = 'testpass', redirectTo = '/' } = {}) {
		const formData = new FormData();
		formData.set('username', username);
		formData.set('password', password);
		formData.set('redirectTo', redirectTo);
		return formData;
	}

	/**
	 * Creates a mock SvelteKit request event for the login action.
	 * @param {object} [options]
	 * @param {FormData} [options.formData]
	 * @returns {any}
	 */
	function createEvent({ formData } = {}) {
		return {
			request: {
				formData: () => Promise.resolve(formData || createFormData())
			},
			fetch: mockFetch,
			cookies: mockCookies,
			url: mockUrl
		};
	}

	test('should redirect on successful login', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=new-token; Path=/; HttpOnly; Secure; SameSite=Lax'
			})
		});

		await expect(actions.login(createEvent())).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
	});

	test('should send correct credentials to API', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=token; Path=/'
			})
		});

		try {
			await actions.login(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/auth/login/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
			credentials: 'omit'
		});
	});

	test('should set cookies from API response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=new-token; Path=/; HttpOnly; Secure; SameSite=Lax'
			})
		});

		try {
			await actions.login(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockCookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'new-token',
			expect.objectContaining({ path: '/' })
		);
	});

	test('should redirect to custom redirectTo path', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=token; Path=/'
			})
		});

		const formData = createFormData({ redirectTo: '/dashboard' });

		await expect(actions.login(createEvent({ formData }))).rejects.toMatchObject({
			status: 303,
			location: '/dashboard'
		});
	});

	test('should return fail(400) on invalid credentials', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: () =>
				Promise.resolve({
					non_field_errors: ['Unable to log in with provided credentials.']
				})
		});

		const result = await actions.login(createEvent());

		expect(result?.status).toBe(400);
		expect(/** @type {any} */ (result)?.data?.error).toBe(
			'Unable to log in with provided credentials.'
		);
	});

	test('should return fail(500) on server error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: () => Promise.resolve({ detail: 'Internal server error' })
		});

		const result = await actions.login(createEvent());

		expect(result?.status).toBe(500);
		expect(/** @type {any} */ (result)?.data?.error).toBe('Internal server error');
	});

	test('should return generic error when response JSON parsing fails', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: () => Promise.reject(new Error('Invalid JSON'))
		});

		const result = await actions.login(createEvent());

		expect(result?.status).toBe(400);
		expect(/** @type {any} */ (result)?.data?.error).toBe(
			'Login failed. Please check your credentials.'
		);
	});

	test('should return fail(500) when set-cookie header is missing', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers()
		});

		const result = await actions.login(createEvent());

		expect(result?.status).toBe(500);
		expect(/** @type {any} */ (result)?.data?.error).toBe(
			'Authentication response missing required tokens.'
		);
	});

	test('should return fail(500) on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		const result = await actions.login(createEvent());

		expect(result?.status).toBe(500);
		expect(/** @type {any} */ (result)?.data?.error).toBe(
			'An internal error occurred during login.'
		);
	});

	test('should set selected-project cookie if not present', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=token; Path=/'
			})
		});

		try {
			await actions.login(createEvent());
		} catch {
			// redirect throws
		}

		expect(mockCookies.set).toHaveBeenCalledWith('selected-project', '1', expect.objectContaining({
			path: '/',
			httpOnly: false,
			sameSite: 'lax'
		}));
	});

	test('should not overwrite existing selected-project cookie', async () => {
		mockCookies.get = vi.fn((name) => {
			if (name === 'selected-project') return '5';
			return null;
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=token; Path=/'
			})
		});

		try {
			await actions.login(createEvent());
		} catch {
			// redirect throws
		}

		const projectCookieCall = mockCookies.set.mock.calls.find(
			(/** @type {any[]} */ c) => c[0] === 'selected-project'
		);
		expect(projectCookieCall).toBeUndefined();
	});

	test('should default redirectTo to / when not provided in form', async () => {
		const formData = new FormData();
		formData.set('username', 'user');
		formData.set('password', 'pass');

		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({
				'set-cookie': 'api-access-token=token; Path=/'
			})
		});

		await expect(actions.login(createEvent({ formData }))).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
	});
});
