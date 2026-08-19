import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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

vi.mock('set-cookie-parser', () => ({
	default: {
		parse: (headers: string[]) =>
			headers.map((h) => {
				const [pair, ...attrs] = h.split(';').map((s) => s.trim());
				const [name, value] = pair.split('=');
				const attrMap = Object.fromEntries(
					attrs.map((a) => {
						const [k, v] = a.split('=');
						return [k.toLowerCase(), v ?? true];
					})
				);
				return {
					name,
					value,
					path: attrMap['path'],
					httpOnly: 'httponly' in attrMap,
					secure: 'secure' in attrMap,
					sameSite: attrMap['samesite'],
					domain: attrMap['domain']
				};
			})
	}
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

function okJson(data: unknown) {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(data),
		text: () => Promise.resolve(JSON.stringify(data))
	};
}

function statusResponse(status: number, body: unknown = {}) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
		headers: { getSetCookie: () => [] }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
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
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'malte', is_staff: true }) as unknown as Response)
			.mockResolvedValueOnce(okJson({ routes: {}, is_superuser: false }) as unknown as Response);

		const result = await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		expect(user.username).toBe('malte');
		expect(user.isAdmin).toBe(true);
		expect(user.permissions).toEqual({ routes: {}, is_superuser: false });
		expect(result).toBe('resolved:/map');
	});

	test('sends the access token as a Cookie header when validating the user', async () => {
		const { event } = makeEvent({
			pathname: '/map',
			cookies: { 'api-access-token': 'abc123' }
		});
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'x' }) as unknown as Response)
			.mockResolvedValueOnce(okJson({ routes: {}, is_superuser: false }) as unknown as Response);

		await handleAuth({ event, resolve });

		const firstCall = vi.mocked(event.fetch).mock.calls[0];
		expect(firstCall[0]).toContain('auth/user/');
		const headers = (firstCall[1] as { headers: Headers }).headers;
		expect(headers.get('Cookie')).toBe('api-access-token=abc123');
	});

	test('refreshes the token on a 401 and retries the user fetch', async () => {
		const { event } = makeEvent({
			pathname: '/map',
			cookies: { 'api-access-token': 'stale', 'api-refresh-token': 'refresh-me' }
		});
		vi.mocked(event.fetch)
			// initial user fetch -> 401
			.mockResolvedValueOnce(statusResponse(401) as unknown as Response)
			// token refresh -> ok with a fresh access cookie
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: {
					getSetCookie: () => ['api-access-token=fresh; Path=/; HttpOnly']
				}
			} as unknown as Response)
			// retried user fetch -> ok
			.mockResolvedValueOnce(okJson({ username: 'malte' }) as unknown as Response)
			// permissions fetch
			.mockResolvedValueOnce(okJson({ routes: {}, is_superuser: false }) as unknown as Response);

		await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		// the refresh set the new access token cookie
		expect(event.cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'fresh',
			expect.objectContaining({ path: '/' })
		);
		// retried fetch used the fresh token
		const retryCall = vi.mocked(event.fetch).mock.calls[2];
		expect((retryCall[1] as { headers: Headers }).headers.get('Cookie')).toBe(
			'api-access-token=fresh'
		);
	});

	test('clears cookies and marks unauthenticated when refresh fails', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: { 'api-access-token': 'stale', 'api-refresh-token': 'bad' }
		});
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(statusResponse(401) as unknown as Response)
			// refresh -> not ok
			.mockResolvedValueOnce(statusResponse(401) as unknown as Response);

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
		vi.mocked(event.fetch).mockResolvedValueOnce(statusResponse(401) as unknown as Response);

		await handleAuth({ event, resolve });

		// only the single user fetch happened; no refresh POST
		expect(event.fetch).toHaveBeenCalledTimes(1);
		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
	});

	test('marks unauthenticated when the user fetch throws (network error)', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: {}
		});
		vi.mocked(event.fetch).mockRejectedValueOnce(new Error('boom'));

		await handleAuth({ event, resolve });

		expect((event.locals.user as unknown as Record<string, unknown>).isAuthenticated).toBe(false);
		expect(event.cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
	});

	test('redirects an authenticated user away from /login to /map', async () => {
		const { event } = makeEvent({
			pathname: '/login',
			cookies: { 'api-access-token': 'good' }
		});
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'malte' }) as unknown as Response)
			.mockResolvedValueOnce(okJson({ routes: {}, is_superuser: false }) as unknown as Response);

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
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'malte' }) as unknown as Response)
			.mockResolvedValueOnce(okJson({ routes: {}, is_superuser: false }) as unknown as Response);

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			location: string;
		};

		expect(err.location).toBe('/map');
	});

	test('redirects an unauthenticated user to /login preserving the target path', async () => {
		const { event } = makeEvent({
			pathname: '/network-schema',
			search: '?foo=bar',
			cookies: {}
		});
		vi.mocked(event.fetch).mockResolvedValueOnce(statusResponse(401) as unknown as Response);

		const err = (await handleAuth({ event, resolve }).catch((e: unknown) => e)) as Error & {
			status: number;
			location: string;
		};

		expect(err.status).toBe(303);
		expect(err.location).toBe(`/login?redirectTo=${encodeURIComponent('/network-schema?foo=bar')}`);
	});

	test('allows unauthenticated access to public routes without redirect', async () => {
		const { event } = makeEvent({ pathname: '/login', cookies: {} });
		vi.mocked(event.fetch).mockResolvedValueOnce(statusResponse(401) as unknown as Response);

		const result = await handleAuth({ event, resolve });

		expect(result).toBe('resolved:/login');
	});

	test('allows unauthenticated access to internal /api/ routes', async () => {
		const { event } = makeEvent({ pathname: '/api/logs', cookies: {} });
		vi.mocked(event.fetch).mockResolvedValueOnce(statusResponse(401) as unknown as Response);

		const result = await handleAuth({ event, resolve });

		expect(result).toBe('resolved:/api/logs');
	});

	test('redirects to /map when permissions deny the requested route', async () => {
		const { event } = makeEvent({
			pathname: '/admin/settings',
			cookies: { 'api-access-token': 'good' }
		});
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'malte' }) as unknown as Response)
			.mockResolvedValueOnce(
				okJson({
					routes: { '/admin/settings': false },
					is_superuser: false
				}) as unknown as Response
			);

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
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'root' }) as unknown as Response)
			.mockResolvedValueOnce(
				okJson({
					routes: { '/admin/settings': false },
					is_superuser: true
				}) as unknown as Response
			);

		const result = await handleAuth({ event, resolve });

		expect(result).toBe('resolved:/admin/settings');
	});

	test('honours wildcard route permissions (/admin/*)', async () => {
		const { event } = makeEvent({
			pathname: '/admin/logs',
			cookies: { 'api-access-token': 'good' }
		});
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'malte' }) as unknown as Response)
			.mockResolvedValueOnce(
				okJson({
					routes: { '/admin/*': false },
					is_superuser: false
				}) as unknown as Response
			);

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
		vi.mocked(event.fetch)
			.mockResolvedValueOnce(okJson({ username: 'malte' }) as unknown as Response)
			.mockRejectedValueOnce(new Error('perm boom'));

		const result = await handleAuth({ event, resolve });

		const user = event.locals.user as unknown as Record<string, unknown>;
		expect(user.isAuthenticated).toBe(true);
		expect(user.permissions).toBeNull();
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
