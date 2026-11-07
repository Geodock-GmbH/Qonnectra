import { beforeEach, describe, expect, test, vi } from 'vitest';

type LoginInput = { username: string; _password: string; redirectTo?: string };

const kit = vi.hoisted(() => ({
	error: vi.fn((status: number, message: string) => {
		throw Object.assign(new Error(message), { status, body: { message } });
	}),
	invalid: vi.fn((message: string) => {
		throw Object.assign(new Error(message), { invalid: message });
	}),
	redirect: vi.fn((status: number, location: string) => {
		throw Object.assign(new Error('redirect'), { status, location });
	})
}));

const requestState = vi.hoisted(() => ({
	handler: null as ((input: LoginInput) => Promise<unknown>) | null,
	event: null as unknown
}));

const landing = vi.hoisted(() => ({ landingPathFor: vi.fn() }));

vi.mock('@sveltejs/kit', () => kit);
vi.mock('$env/static/private', () => ({ API_URL: 'http://api.test/' }));
vi.mock('$app/server', () => ({
	form: (_schema: unknown, handler: (input: LoginInput) => Promise<unknown>) => {
		requestState.handler = handler;
		return Object.assign(() => undefined, { __: { type: 'form' } });
	},
	getRequestEvent: () => requestState.event
}));
vi.mock('$lib/server/landing', () => ({ landingPathFor: landing.landingPathFor }));

import { loginRequestInit } from './login-request';
import './login.remote';

const fetchMock = vi.fn();

/**
 * Builds a response shaped like the backend's login response.
 * @param options - Status, parsed body and the forwarded `Set-Cookie` headers.
 */
function makeResponse(options: {
	ok?: boolean;
	status?: number;
	body?: unknown;
	cookies?: string[];
} = {}) {
	const { ok = true, status = 200, body = {}, cookies = [] } = options;
	return {
		ok,
		status,
		json: vi.fn().mockResolvedValue(body),
		headers: { getSetCookie: () => cookies }
	} as unknown as Response;
}

/**
 * Registers the request event the mocked `getRequestEvent` returns.
 * @param response - What the mocked fetch resolves to, or the rejection to throw.
 */
function setRequest(response: Response | Error) {
	const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
	if (response instanceof Error) {
		fetchMock.mockRejectedValue(response);
	} else {
		fetchMock.mockResolvedValue(response);
	}
	requestState.event = {
		cookies,
		fetch: fetchMock,
		url: new URL('https://app.test/login')
	};
	return cookies;
}

function runLogin(input: LoginInput) {
	return requestState.handler!(input);
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.clearAllMocks();
});

describe('loginRequestInit', () => {
	test('sends the credentials form-encoded, as the endpoint accepts', () => {
		const init = loginRequestInit('testuser', 'testpass123');

		expect(init).toMatchObject({
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			credentials: 'omit'
		});
		expect(init.body).toBeInstanceOf(URLSearchParams);
		expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
			username: 'testuser',
			password: 'testpass123'
		});
	});
});

describe('login handler', () => {
	test('posts the form-encoded request and forwards the session cookies', async () => {
		const cookies = setRequest(
			makeResponse({
				cookies: [
					'api-access-token=access; Path=/; HttpOnly; Secure; SameSite=Lax',
					'api-refresh-token=refresh; Path=/; HttpOnly; Secure; SameSite=Lax'
				]
			})
		);

		await expect(
			runLogin({ username: 'testuser', _password: 'testpass123', redirectTo: '/map' })
		).rejects.toMatchObject({ status: 303, location: '/map' });

		expect(fetchMock).toHaveBeenCalledWith(
			'http://api.test/auth/login/',
			loginRequestInit('testuser', 'testpass123')
		);
		expect(cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'access',
			expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' })
		);
		expect(cookies.set).toHaveBeenCalledWith(
			'api-refresh-token',
			'refresh',
			expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' })
		);
		expect(kit.redirect).toHaveBeenCalledWith(303, '/map');
	});

	test('ignores an off-site redirect target and uses the landing page', async () => {
		const cookies = setRequest(makeResponse({ cookies: ['api-access-token=access; Path=/'] }));
		landing.landingPathFor.mockResolvedValue('/settings');

		await expect(
			runLogin({ username: 'testuser', _password: 'testpass123', redirectTo: 'https://evil.com' })
		).rejects.toMatchObject({ status: 303, location: '/settings' });

		expect(landing.landingPathFor).toHaveBeenCalledWith(fetchMock, cookies);
		expect(kit.redirect).toHaveBeenCalledWith(303, '/settings');
	});

	test('reports rejected credentials as a form-level issue', async () => {
		setRequest(
			makeResponse({
				ok: false,
				status: 400,
				body: { non_field_errors: ['Unable to log in with provided credentials.'] }
			})
		);

		await expect(runLogin({ username: 'testuser', _password: 'wrong' })).rejects.toMatchObject({
			invalid: 'Unable to log in with provided credentials.'
		});
		expect(kit.invalid).toHaveBeenCalledWith('Unable to log in with provided credentials.');
	});

	test('surfaces backend errors as a 500', async () => {
		setRequest(makeResponse({ ok: false, status: 500, body: { detail: 'Internal server error' } }));

		await expect(runLogin({ username: 'testuser', _password: 'testpass123' })).rejects.toMatchObject({
			status: 500,
			body: { message: 'Internal server error' }
		});
	});

	test('surfaces a network failure as a 500', async () => {
		setRequest(new Error('boom'));

		await expect(runLogin({ username: 'testuser', _password: 'testpass123' })).rejects.toMatchObject({
			status: 500,
			body: { message: 'An internal error occurred during login.' }
		});
	});

	test('fails when the backend sets no session cookies', async () => {
		setRequest(makeResponse());

		await expect(runLogin({ username: 'testuser', _password: 'testpass123' })).rejects.toMatchObject({
			status: 500,
			body: { message: 'Authentication response missing required tokens.' }
		});
	});
});
