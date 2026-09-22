import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { clearSessionCache, endSession } from '$lib/server/session';

import { handleAuth, handleProjectRedirect, PUBLIC_ROUTES } from './hooks.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const redirectError = new Error('redirect') as Error & { status: number; location: string };
		redirectError.status = status;
		redirectError.location = location;
		return redirectError;
	},
	sequence:
		(...handlers: unknown[]) =>
		() =>
			handlers
}));

vi.mock('@sveltejs/kit/hooks', () => ({
	sequence:
		(...handlers: unknown[]) =>
		() =>
			handlers
}));

vi.mock('$lib/paraglide/server', () => ({
	paraglideMiddleware: vi.fn()
}));

/**
 * Builds a mock RequestEvent with cookie storage, a stubbed fetch and a URL.
 */
function makeEvent({
	pathname = '/map',
	search = '',
	cookies = {},
	protocol = 'http:'
}: {
	pathname?: string;
	search?: string;
	cookies?: Record<string, string>;
	protocol?: string;
} = {}) {
	const store: Record<string, string> = { ...cookies };
	const setCalls: { name: string; value: string; options: Record<string, unknown> }[] = [];
	const deleteCalls: string[] = [];

	const event = {
		url: new URL(`${protocol === 'https:' ? 'https' : 'http'}://localhost${pathname}${search}`),
		locals: {} as Record<string, unknown>,
		fetch: vi.fn(),
		cookies: {
			get: vi.fn((name: string) => store[name]),
			set: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
				store[name] = value;
				setCalls.push({ name, value, options });
			}),
			delete: vi.fn((name: string) => {
				delete store[name];
				deleteCalls.push(name);
			})
		}
	} as unknown as RequestEvent;

	return { event, setCalls, deleteCalls, store };
}

const resolve = vi.fn(
	(event: RequestEvent) => `resolved:${event.url.pathname}`
) as unknown as Parameters<typeof handleAuth>[0]['resolve'];

function okJson(data: unknown): Response {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(data),
		text: () => Promise.resolve(JSON.stringify(data)),
		headers: { getSetCookie: () => [] }
	} as unknown as Response;
}

function statusResponse(status: number, setCookies: string[] = []): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve({}),
		text: () => Promise.resolve(''),
		headers: { getSetCookie: () => setCookies }
	} as unknown as Response;
}

/**
 * Answers Django's auth endpoints from per-endpoint queues; the last entry
 * of a queue repeats once the queue is exhausted. Defaults to a valid user
 * with empty permissions and a refused refresh.
 */
function mockDjango(
	event: RequestEvent,
	queues: { user?: (Response | Error)[]; permissions?: (Response | Error)[]; refresh?: Response[] }
) {
	const remaining = {
		user: [...(queues.user ?? [okJson({ username: 'malte' })])],
		permissions: [...(queues.permissions ?? [okJson({ routes: {}, is_superuser: false })])],
		refresh: [...(queues.refresh ?? [statusResponse(401)])]
	};
	vi.mocked(event.fetch).mockImplementation((input) => {
		const url = String(input);
		const key = url.includes('auth/user/')
			? 'user'
			: url.includes('auth/permissions/')
				? 'permissions'
				: 'refresh';
		const queue = remaining[key];
		const next = queue.length > 1 ? queue.shift() : queue[0];
		return next instanceof Error ? Promise.reject(next) : Promise.resolve(next as Response);
	});
}

/** Number of fetches that hit the given Django endpoint. */
function callsTo(event: RequestEvent, endpoint: string): number {
	return vi.mocked(event.fetch).mock.calls.filter(([url]) => String(url).includes(endpoint)).length;
}

beforeEach(() => {
	vi.clearAllMocks();
	clearSessionCache();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PUBLIC_ROUTES', () => {
	test('exposes /login as a public route', () => {
		expect(PUBLIC_ROUTES).toContain('/login');
	});
});

describe('handleAuth', () => {
	test('populates authenticated user and permissions on a valid token', async () => {
		const { event } = makeEvent({
			pathname: '/map',
			cookies: { 'api-access-token': 'good-token' }
		});
		mockDjango(event, {
			user: [okJson({ username: 'malte', is_staff: true })],
			permissions: [okJson({ routes: {}, is_superuser: false })]
		});

		const result = await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		expect(user.username).toBe('malte');
		expect(user.isAdmin).toBe(true);
		expect(user.permissions).toEqual({ routes: {}, is_superuser: false });
		expect(result).toBe('resolved:/map');
	});

	test('sends the access token as a Cookie header to both auth endpoints', async () => {
		const { event } = makeEvent({
			pathname: '/map',
			cookies: { 'api-access-token': 'abc123' }
		});
		mockDjango(event, {});

		await handleAuth({ event, resolve });

		const calls = vi.mocked(event.fetch).mock.calls;
		expect(calls.map(([url]) => String(url))).toEqual([
			'http://localhost:8000/auth/user/',
			'http://localhost:8000/auth/permissions/'
		]);
		for (const [, init] of calls) {
			expect((init as { headers: Record<string, string> }).headers.Cookie).toBe(
				'api-access-token=abc123'
			);
		}
	});

	test('answers a second request with the same token from the session cache', async () => {
		const first = makeEvent({ pathname: '/map', cookies: { 'api-access-token': 'same' } });
		mockDjango(first.event, {});
		await handleAuth({ event: first.event, resolve });

		const second = makeEvent({
			pathname: '/_app/remote/abc/getConduitList',
			cookies: { 'api-access-token': 'same' }
		});
		mockDjango(second.event, {});
		await handleAuth({ event: second.event, resolve });

		expect(callsTo(first.event, 'auth/user/') + callsTo(second.event, 'auth/user/')).toBe(1);
		expect(
			callsTo(first.event, 'auth/permissions/') + callsTo(second.event, 'auth/permissions/')
		).toBe(1);
		expect((second.event.locals.user as unknown as Record<string, unknown>).username).toBe('malte');
	});

	test('resolves a different token with its own fetches', async () => {
		const first = makeEvent({ pathname: '/map', cookies: { 'api-access-token': 'one' } });
		mockDjango(first.event, {});
		await handleAuth({ event: first.event, resolve });

		const second = makeEvent({ pathname: '/map', cookies: { 'api-access-token': 'two' } });
		mockDjango(second.event, { user: [okJson({ username: 'other' })] });
		await handleAuth({ event: second.event, resolve });

		expect(callsTo(second.event, 'auth/user/')).toBe(1);
		expect((second.event.locals.user as unknown as Record<string, unknown>).username).toBe('other');
	});

	test('fetches again after the session was ended by a logout', async () => {
		const first = makeEvent({ pathname: '/map', cookies: { 'api-access-token': 'bye' } });
		mockDjango(first.event, {});
		await handleAuth({ event: first.event, resolve });

		endSession(first.event.cookies);

		const second = makeEvent({ pathname: '/map', cookies: { 'api-access-token': 'bye' } });
		mockDjango(second.event, {});
		await handleAuth({ event: second.event, resolve });

		expect(callsTo(second.event, 'auth/user/')).toBe(1);
	});

	test('refreshes the token on a 401 and retries the user fetch', async () => {
		const { event } = makeEvent({
			pathname: '/map',
			cookies: { 'api-access-token': 'stale', 'api-refresh-token': 'refresh-me' }
		});
		mockDjango(event, {
			user: [statusResponse(401), okJson({ username: 'malte' })],
			permissions: [statusResponse(401), okJson({ routes: {}, is_superuser: false })],
			refresh: [statusResponse(200, ['api-access-token=fresh; Path=/; HttpOnly'])]
		});

		await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'fresh',
			expect.objectContaining({ path: '/' })
		);
		const retry = vi
			.mocked(event.fetch)
			.mock.calls.filter(([url]) => String(url).includes('auth/user/'))[1];
		expect((retry[1] as { headers: Record<string, string> }).headers.Cookie).toBe(
			'api-access-token=fresh'
		);
	});

	test('clears cookies and marks unauthenticated when refresh fails', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: { 'api-access-token': 'stale', 'api-refresh-token': 'bad' }
		});
		mockDjango(event, { user: [statusResponse(401)], refresh: [statusResponse(401)] });

		await handleAuth({ event, resolve });

		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
		expect(event.cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
		expect(event.cookies.delete).toHaveBeenCalledWith('api-refresh-token', { path: '/' });
	});

	test('does not attempt refresh when there is no refresh token', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: { 'api-access-token': 'stale' }
		});
		mockDjango(event, { user: [statusResponse(401)] });

		await handleAuth({ event, resolve });

		expect(callsTo(event, 'auth/token/refresh/')).toBe(0);
		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
	});

	test('does not ask Django at all when the request carries no token', async () => {
		const { event } = makeEvent({ pathname: '/login', cookies: {} });
		mockDjango(event, {});

		await handleAuth({ event, resolve });

		expect(event.fetch).not.toHaveBeenCalled();
		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
	});

	test('marks unauthenticated when the user fetch throws (network error)', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: { 'api-access-token': 'tok' }
		});
		mockDjango(event, { user: [new Error('boom')] });

		await handleAuth({ event, resolve });

		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
		expect(event.cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
	});

	test('redirects an authenticated user away from /login to /map', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {});

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			status: number;
			location: string;
		};

		expect(err.status).toBe(303);
		expect(err.location).toBe('/map');
	});

	test('redirects the root path / to /map for authenticated users', async () => {
		const { event } = makeEvent({
			pathname: '/',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {});

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			location: string;
		};

		expect(err.location).toBe('/map');
	});

	test('redirects an unauthenticated user to /login preserving path and query', async () => {
		const { event } = makeEvent({
			pathname: '/network-schema',
			search: '?foo=bar',
			cookies: {}
		});
		mockDjango(event, {});

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			status: number;
			location: string;
		};

		expect(err.status).toBe(303);
		expect(err.location).toBe(`/login?redirectTo=${encodeURIComponent('/network-schema?foo=bar')}`);
	});

	test('allows unauthenticated access to public routes without redirect', async () => {
		const { event } = makeEvent({ pathname: '/login', cookies: {} });
		mockDjango(event, {});

		const result = await handleAuth({ event, resolve });

		expect(result).toBe('resolved:/login');
	});

	test('allows unauthenticated access to remote function endpoints', async () => {
		const { event } = makeEvent({ pathname: '/_app/remote/abc123/login', cookies: {} });
		mockDjango(event, {});

		const result = await handleAuth({ event, resolve });

		expect(result).toBe('resolved:/_app/remote/abc123/login');
	});

	test('redirects to /map when permissions deny the requested route', async () => {
		const { event } = makeEvent({
			pathname: '/admin/settings',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			permissions: [okJson({ routes: { '/admin/settings': false }, is_superuser: false })]
		});

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			location: string;
		};

		expect(err.location).toBe('/map');
	});

	test('allows a superuser to access any route', async () => {
		const { event } = makeEvent({
			pathname: '/admin/settings',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			user: [okJson({ username: 'root' })],
			permissions: [okJson({ routes: { '/admin/settings': false }, is_superuser: true })]
		});

		const result = await handleAuth({ event, resolve });

		expect(result).toBe('resolved:/admin/settings');
	});

	test('honours wildcard route permissions (/admin/*)', async () => {
		const { event } = makeEvent({
			pathname: '/admin/logs',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			permissions: [okJson({ routes: { '/admin/*': false }, is_superuser: false })]
		});

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			location: string;
		};

		expect(err.location).toBe('/map');
	});

	test('still authenticates when the permissions fetch fails', async () => {
		const { event } = makeEvent({
			pathname: '/map',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, { permissions: [new Error('perm boom')] });

		const result = await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		expect(user.permissions).toBeUndefined();
		expect(result).toBe('resolved:/map');
	});
});

describe('handleProjectRedirect', () => {
	test('redirects a bare project route to include the selected project slug', async () => {
		const { event } = makeEvent({
			pathname: '/trench',
			cookies: { 'selected-project': 'my-project' }
		});

		const err = (await handleProjectRedirect({ event, resolve }).catch(
			(e: unknown) => e
		)) as Error & { status: number; location: string };

		expect(err.status).toBe(303);
		expect(err.location).toBe('/trench/my-project');
	});

	test('does not redirect when no project is selected', async () => {
		const { event } = makeEvent({ pathname: '/trench', cookies: {} });

		const result = await handleProjectRedirect({ event, resolve });

		expect(result).toBe('resolved:/trench');
	});

	test('does not redirect a route that already has a slug', async () => {
		const { event } = makeEvent({
			pathname: '/trench/my-project',
			cookies: { 'selected-project': 'my-project' }
		});

		const result = await handleProjectRedirect({ event, resolve });

		expect(result).toBe('resolved:/trench/my-project');
	});

	test('does not redirect non-project routes', async () => {
		const { event } = makeEvent({
			pathname: '/settings',
			cookies: { 'selected-project': 'my-project' }
		});

		const result = await handleProjectRedirect({ event, resolve });

		expect(result).toBe('resolved:/settings');
	});
});
