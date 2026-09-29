import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	clearSessionCache,
	endSession,
	evictSession,
	resolveSession,
	SESSION_CACHE_MAX_ENTRIES,
	SESSION_CACHE_TTL_MS
} from './session';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

/**
 * Builds a request event with a cookie jar and a fetch stub.
 * @param cookies - Initial cookie values.
 */
function makeEvent(cookies: Record<string, string> = {}) {
	const store: Record<string, string> = { ...cookies };
	const event = {
		url: new URL('http://localhost/map'),
		fetch: vi.fn(),
		cookies: {
			get: vi.fn((name: string) => store[name]),
			set: vi.fn((name: string, value: string) => {
				store[name] = value;
			}),
			delete: vi.fn((name: string) => {
				delete store[name];
			})
		}
	} as unknown as RequestEvent;
	return event;
}

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
 * of a queue repeats once the queue is exhausted.
 */
function mockDjango(
	event: RequestEvent,
	queues: { user?: (Response | Error)[]; permissions?: (Response | Error)[]; refresh?: Response[] }
) {
	const remaining = {
		user: [...(queues.user ?? [okJson({ username: 'malte', is_staff: false })])],
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
	clearSessionCache();
	vi.useFakeTimers();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('resolveSession', () => {
	test('should fetch user and permissions in parallel on a cache miss', async () => {
		const event = makeEvent({ 'api-access-token': 'tok' });
		let releaseUser: (response: Response) => void = () => {};
		vi.mocked(event.fetch).mockImplementation((input) => {
			if (String(input).includes('auth/user/')) {
				return new Promise<Response>((resolve) => {
					releaseUser = resolve;
				});
			}
			return Promise.resolve(okJson({ routes: { '/map': true }, is_superuser: false }));
		});

		const pending = resolveSession(event);
		await vi.advanceTimersByTimeAsync(0);
		expect(callsTo(event, 'auth/permissions/')).toBe(1);

		releaseUser(okJson({ username: 'malte', is_staff: true }));
		const user = await pending;

		expect(user).toMatchObject({
			isAuthenticated: true,
			username: 'malte',
			isAdmin: true,
			permissions: { routes: { '/map': true }, is_superuser: false }
		});
		const headers = (vi.mocked(event.fetch).mock.calls[0][1] as { headers: Record<string, string> })
			.headers;
		expect(headers.Cookie).toBe('api-access-token=tok');
	});

	test('should answer a second request with the same token from the cache', async () => {
		const first = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(first, {});
		const user = await resolveSession(first);

		const second = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(second, {});
		expect(await resolveSession(second)).toBe(user);
		expect(second.fetch).not.toHaveBeenCalled();
	});

	test('should refetch once the TTL has passed', async () => {
		const first = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(first, {});
		await resolveSession(first);

		vi.advanceTimersByTime(SESSION_CACHE_TTL_MS);

		const second = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(second, {});
		await resolveSession(second);
		expect(callsTo(second, 'auth/user/')).toBe(1);
		expect(callsTo(second, 'auth/permissions/')).toBe(1);
	});

	test('should not share entries between tokens', async () => {
		const first = makeEvent({ 'api-access-token': 'a' });
		mockDjango(first, {});
		await resolveSession(first);

		const second = makeEvent({ 'api-access-token': 'b' });
		mockDjango(second, { user: [okJson({ username: 'other' })] });
		expect((await resolveSession(second)).username).toBe('other');
	});

	test('should not ask Django at all without any token', async () => {
		const event = makeEvent();
		mockDjango(event, {});

		expect(await resolveSession(event)).toEqual({ isAuthenticated: false });
		expect(event.fetch).not.toHaveBeenCalled();
	});

	test('should refresh a rejected token, retry with the new one and cache under it', async () => {
		const event = makeEvent({ 'api-access-token': 'stale', 'api-refresh-token': 'refresh-me' });
		mockDjango(event, {
			user: [statusResponse(401), okJson({ username: 'malte' })],
			permissions: [statusResponse(401), okJson({ routes: {}, is_superuser: false })],
			refresh: [statusResponse(200, ['api-access-token=fresh; Path=/; HttpOnly'])]
		});

		const user = await resolveSession(event);

		expect(user.isAuthenticated).toBe(true);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'fresh',
			expect.objectContaining({ path: '/', httpOnly: true })
		);
		const retry = vi
			.mocked(event.fetch)
			.mock.calls.filter(([url]) => String(url).includes('auth/user/'))[1];
		expect((retry[1] as { headers: Record<string, string> }).headers.Cookie).toBe(
			'api-access-token=fresh'
		);
		const refreshCall = vi
			.mocked(event.fetch)
			.mock.calls.find(([url]) => String(url).includes('auth/token/refresh/'));
		expect((refreshCall?.[1] as { headers: Record<string, string> }).headers.Cookie).toBe(
			'api-refresh-token=refresh-me'
		);

		const next = makeEvent({ 'api-access-token': 'fresh' });
		mockDjango(next, {});
		await resolveSession(next);
		expect(next.fetch).not.toHaveBeenCalled();
	});

	test('should drop the entry and the cookies when a cached token is later rejected', async () => {
		const first = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(first, {});
		await resolveSession(first);
		vi.advanceTimersByTime(SESSION_CACHE_TTL_MS);

		const second = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(second, { user: [statusResponse(401)] });
		expect(await resolveSession(second)).toEqual({ isAuthenticated: false });
		expect(second.cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
		expect(second.cookies.delete).toHaveBeenCalledWith('api-refresh-token', { path: '/' });
	});

	test('should still authenticate when only the permissions call fails', async () => {
		const event = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(event, { permissions: [new Error('perm boom')] });

		const user = await resolveSession(event);

		expect(user.isAuthenticated).toBe(true);
		expect(user.permissions).toBeUndefined();
	});

	test('should treat a network error on the user call as unauthenticated', async () => {
		const event = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(event, { user: [new Error('boom')] });

		expect(await resolveSession(event)).toEqual({ isAuthenticated: false });
		expect(event.cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
	});

	test('should evict the oldest entry once the cache is full', async () => {
		for (let i = 0; i <= SESSION_CACHE_MAX_ENTRIES; i++) {
			const event = makeEvent({ 'api-access-token': `t${i}` });
			mockDjango(event, {});
			await resolveSession(event);
		}

		const oldest = makeEvent({ 'api-access-token': 't0' });
		mockDjango(oldest, {});
		await resolveSession(oldest);
		expect(callsTo(oldest, 'auth/user/')).toBe(1);

		const newest = makeEvent({ 'api-access-token': `t${SESSION_CACHE_MAX_ENTRIES}` });
		mockDjango(newest, {});
		await resolveSession(newest);
		expect(newest.fetch).not.toHaveBeenCalled();
	});
});

describe('endSession and evictSession', () => {
	test('endSession should forget the token and delete both cookies', async () => {
		const event = makeEvent({ 'api-access-token': 'tok', 'api-refresh-token': 'r' });
		mockDjango(event, {});
		await resolveSession(event);

		endSession(event.cookies);

		expect(event.cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
		expect(event.cookies.delete).toHaveBeenCalledWith('api-refresh-token', { path: '/' });
		const again = makeEvent({ 'api-access-token': 'tok' });
		mockDjango(again, {});
		await resolveSession(again);
		expect(callsTo(again, 'auth/user/')).toBe(1);
	});

	test('evictSession should ignore a missing token', () => {
		expect(() => evictSession(undefined)).not.toThrow();
	});
});
