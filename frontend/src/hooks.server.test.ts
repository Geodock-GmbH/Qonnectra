import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { clearSessionCache, endSession } from '$lib/server/session';

import { handleAuth, PUBLIC_ROUTES } from './hooks.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const redirectError = new Error('redirect') as Error & { status: number; location: string };
		redirectError.status = status;
		redirectError.location = location;
		throw redirectError;
	},
	error: (status: number, message: string) => {
		const httpError = new Error(message) as Error & { status: number };
		httpError.status = status;
		throw httpError;
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
 * Builds a mock RequestEvent with cookie storage, a stubbed fetch, a URL and a route id.
 */
function makeEvent({
	pathname = '/project/7/map',
	routeId = '/project/[projectId=integer]/map',
	search = '',
	cookies = {},
	protocol = 'http:',
	isRemoteRequest = false
}: {
	pathname?: string;
	routeId?: string | null;
	search?: string;
	cookies?: Record<string, string>;
	protocol?: string;
	isRemoteRequest?: boolean;
} = {}) {
	const store: Record<string, string> = { ...cookies };
	const deleteCalls: string[] = [];

	const event = {
		url: new URL(`${protocol === 'https:' ? 'https' : 'http'}://localhost${pathname}${search}`),
		route: { id: routeId },
		isRemoteRequest,
		locals: {} as Record<string, unknown>,
		fetch: vi.fn(),
		cookies: {
			get: vi.fn((name: string) => store[name]),
			set: vi.fn((name: string, value: string) => {
				store[name] = value;
			}),
			delete: vi.fn((name: string) => {
				delete store[name];
				deleteCalls.push(name);
			})
		}
	} as unknown as RequestEvent;

	return { event, deleteCalls, store };
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

const projectRows = [
	{ id: 7, project: 'Nord' },
	{ id: 9, project: 'Süd' }
];

/**
 * Answers Django's endpoints from per-endpoint queues; the last entry of a
 * queue repeats once the queue is exhausted. Defaults to a valid user with
 * empty permissions, two projects and a refused refresh.
 */
function mockDjango(
	event: RequestEvent,
	queues: {
		user?: (Response | Error)[];
		permissions?: (Response | Error)[];
		refresh?: Response[];
		projects?: Response[];
	}
) {
	const remaining = {
		user: [...(queues.user ?? [okJson({ username: 'malte' })])],
		permissions: [...(queues.permissions ?? [okJson({ routes: {}, is_superuser: false })])],
		refresh: [...(queues.refresh ?? [statusResponse(401)])],
		projects: [...(queues.projects ?? [okJson({ results: projectRows })])]
	};
	vi.mocked(event.fetch).mockImplementation((input) => {
		const url = String(input);
		const key = url.includes('auth/user/')
			? 'user'
			: url.includes('auth/permissions/')
				? 'permissions'
				: url.includes('projects/')
					? 'projects'
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

/** Runs the hook and returns the redirect or error it threw. */
async function thrownBy(event: RequestEvent) {
	return (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
		status: number;
		location?: string;
	};
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

describe('handleAuth: session', () => {
	test('populates authenticated user and permissions on a valid token', async () => {
		const { event } = makeEvent({ cookies: { 'api-access-token': 'good-token' } });
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
		expect(result).toBe('resolved:/project/7/map');
	});

	test('sends the access token as a Cookie header to both auth endpoints', async () => {
		const { event } = makeEvent({ cookies: { 'api-access-token': 'abc123' } });
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
		const first = makeEvent({ cookies: { 'api-access-token': 'same' } });
		mockDjango(first.event, {});
		await handleAuth({ event: first.event, resolve });

		const second = makeEvent({
			pathname: '/_app/remote/abc/getConduitList',
			routeId: null,
			cookies: { 'api-access-token': 'same' }
		});
		mockDjango(second.event, {});
		await handleAuth({ event: second.event, resolve });

		expect(callsTo(first.event, 'auth/user/') + callsTo(second.event, 'auth/user/')).toBe(1);
		expect(
			callsTo(first.event, 'auth/permissions/') + callsTo(second.event, 'auth/permissions/')
		).toBe(1);
	});

	test('fetches again after the session was ended by a logout', async () => {
		const first = makeEvent({ cookies: { 'api-access-token': 'bye' } });
		mockDjango(first.event, {});
		await handleAuth({ event: first.event, resolve });

		endSession(first.event.cookies);

		const second = makeEvent({ cookies: { 'api-access-token': 'bye' } });
		mockDjango(second.event, {});
		await handleAuth({ event: second.event, resolve });

		expect(callsTo(second.event, 'auth/user/')).toBe(1);
	});

	test('refreshes the token on a 401 and retries the user fetch', async () => {
		const { event } = makeEvent({
			cookies: { 'api-access-token': 'stale', 'api-refresh-token': 'refresh-me' }
		});
		mockDjango(event, {
			user: [statusResponse(401), okJson({ username: 'malte' })],
			permissions: [statusResponse(401), okJson({ routes: {}, is_superuser: false })],
			refresh: [statusResponse(200, ['api-access-token=fresh; Path=/; HttpOnly'])]
		});

		await handleAuth({ event, resolve });

		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(true);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'fresh',
			expect.objectContaining({ path: '/' })
		);
	});

	test('does not ask Django at all when the request carries no token', async () => {
		const { event } = makeEvent({ pathname: '/login', routeId: '/login', cookies: {} });
		mockDjango(event, {});

		await handleAuth({ event, resolve });

		expect(event.fetch).not.toHaveBeenCalled();
		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
	});

	test('expires the legacy selected-project cookie once', async () => {
		const { event } = makeEvent({
			cookies: { 'api-access-token': 'good', 'selected-project': '3' }
		});
		mockDjango(event, {});

		await handleAuth({ event, resolve });

		expect(event.cookies.delete).toHaveBeenCalledWith('selected-project', { path: '/' });
	});
});

describe('handleAuth: unauthenticated', () => {
	test('redirects to /login preserving path and query', async () => {
		const { event } = makeEvent({
			pathname: '/project/7/conduit',
			routeId: '/project/[projectId=integer]/conduit',
			search: '?search=x&page=2',
			cookies: {}
		});
		mockDjango(event, {});

		const err = await thrownBy(event);

		expect(err.status).toBe(303);
		expect(err.location).toBe(
			`/login?redirectTo=${encodeURIComponent('/project/7/conduit?search=x&page=2')}`
		);
	});

	test('allows public routes and remote function endpoints without redirect', async () => {
		const login = makeEvent({ pathname: '/login', routeId: '/login', cookies: {} });
		mockDjango(login.event, {});
		expect(await handleAuth({ event: login.event, resolve })).toBe('resolved:/login');

		// SvelteKit hands a remote call the URL of the page that made it, not
		// the internal `/_app/remote/…` path.
		const remote = makeEvent({
			pathname: '/project/7/map',
			search: '?feature=trench%3Aabc',
			routeId: null,
			cookies: {},
			isRemoteRequest: true
		});
		mockDjango(remote.event, {});
		expect(await handleAuth({ event: remote.event, resolve })).toBe('resolved:/project/7/map');
	});
});

describe('handleAuth: landing', () => {
	test('sends an authenticated user on /login to the remembered project map', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			routeId: '/login',
			cookies: { 'api-access-token': 'good', 'last-project': '9' }
		});
		mockDjango(event, {});

		const err = await thrownBy(event);

		expect(err.status).toBe(303);
		expect(err.location).toBe('/project/9/map');
	});

	test('sends the root path to the first project when nothing valid is remembered', async () => {
		const { event } = makeEvent({
			pathname: '/',
			routeId: null,
			cookies: { 'api-access-token': 'good', 'last-project': '42' }
		});
		mockDjango(event, {});

		const err = await thrownBy(event);

		expect(err.location).toBe('/project/7/map');
		expect(callsTo(event, 'projects/')).toBe(1);
	});

	test('sends a user without projects to the settings page', async () => {
		const { event } = makeEvent({
			pathname: '/',
			routeId: null,
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, { projects: [okJson({ results: [] })] });

		expect((await thrownBy(event)).location).toBe('/settings');
	});

	test('does not fetch projects on an ordinary page request', async () => {
		const { event } = makeEvent({ cookies: { 'api-access-token': 'good' } });
		mockDjango(event, {});

		await handleAuth({ event, resolve });

		expect(callsTo(event, 'projects/')).toBe(0);
	});
});

describe('handleAuth: permissions', () => {
	test('denies a project page by its permission key, not its pathname', async () => {
		const { event } = makeEvent({
			pathname: '/project/5/valuation',
			routeId: '/project/[projectId=integer]/valuation',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			permissions: [okJson({ routes: { '/valuation': false }, is_superuser: false })]
		});

		const err = await thrownBy(event);

		expect(err.status).toBe(303);
		expect(err.location).toBe('/project/7/map');
	});

	test('lets an exact row cover its sub-routes', async () => {
		const { event } = makeEvent({
			pathname: '/project/5/network-schema/node/77',
			routeId: '/project/[projectId=integer]/network-schema/node/[nodeId]',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			permissions: [okJson({ routes: { '/network-schema': false }, is_superuser: false })]
		});

		expect((await thrownBy(event)).location).toBe('/project/7/map');
	});

	test('answers 403 instead of looping when the landing page itself is denied', async () => {
		const { event } = makeEvent({
			pathname: '/project/7/map',
			routeId: '/project/[projectId=integer]/map',
			cookies: { 'api-access-token': 'good', 'last-project': '7' }
		});
		mockDjango(event, {
			permissions: [okJson({ routes: { '/map': false }, is_superuser: false })]
		});

		const err = await thrownBy(event);

		expect(err.status).toBe(403);
		expect(err.location).toBeUndefined();
	});

	test('allows a superuser to access any route', async () => {
		const { event } = makeEvent({
			pathname: '/admin/logs',
			routeId: '/admin/logs',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			user: [okJson({ username: 'root' })],
			permissions: [okJson({ routes: { '/admin/logs': false }, is_superuser: true })]
		});

		expect(await handleAuth({ event, resolve })).toBe('resolved:/admin/logs');
	});

	test('honours wildcard route permissions (/admin/*)', async () => {
		const { event } = makeEvent({
			pathname: '/admin/logs',
			routeId: '/admin/logs',
			cookies: { 'api-access-token': 'good' }
		});
		mockDjango(event, {
			permissions: [okJson({ routes: { '/admin/*': false }, is_superuser: false })]
		});

		expect((await thrownBy(event)).location).toBe('/project/7/map');
	});

	test('still authenticates and allows the page when the permissions fetch fails', async () => {
		const { event } = makeEvent({ cookies: { 'api-access-token': 'good' } });
		mockDjango(event, { permissions: [new Error('perm boom')] });

		const result = await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		expect(user.permissions).toBeUndefined();
		expect(result).toBe('resolved:/project/7/map');
	});
});
