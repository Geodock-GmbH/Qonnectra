import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { refreshAccessToken } from './tokenRefresh';

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
		url: new URL('http://localhost/project/5/map'),
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
	return { event, store };
}

/**
 * Builds a refresh response with an optional body and `Set-Cookie` headers.
 * @param status - The HTTP status Django answered with.
 * @param body - The parsed JSON body.
 * @param setCookies - Raw `Set-Cookie` header values.
 */
function refreshResponse(status: number, body: unknown = {}, setCookies: string[] = []): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
		headers: { getSetCookie: () => setCookies }
	} as unknown as Response;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('refreshAccessToken', () => {
	test('should not call Django without a refresh token', async () => {
		const { event } = makeEvent();

		expect(await refreshAccessToken(event)).toEqual({ ok: false });
		expect(event.fetch).not.toHaveBeenCalled();
	});

	test('should forward the new tokens onto the response', async () => {
		const { event, store } = makeEvent({ 'api-refresh-token': 'refresh-1' });
		vi.mocked(event.fetch).mockResolvedValue(
			refreshResponse(200, {}, ['api-access-token=fresh; Path=/; HttpOnly'])
		);

		const result = await refreshAccessToken(event);

		expect(result.ok).toBe(true);
		expect(store['api-access-token']).toBe('fresh');
		expect(event.fetch).toHaveBeenCalledWith(
			'http://localhost:8000/auth/token/refresh/',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ Cookie: 'api-refresh-token=refresh-1' })
			})
		);
	});

	test('should report the lifetime Django gives for the new access token', async () => {
		const { event } = makeEvent({ 'api-refresh-token': 'refresh-1' });
		const expiration = new Date(Date.now() + 10 * 60 * 1000).toISOString();
		vi.mocked(event.fetch).mockResolvedValue(
			refreshResponse(200, { access_expiration: expiration })
		);

		const result = await refreshAccessToken(event);

		expect(result.expiresInMs).toBeGreaterThan(9 * 60 * 1000);
		expect(result.expiresInMs).toBeLessThanOrEqual(10 * 60 * 1000);
	});

	test('should omit the lifetime when Django does not report one', async () => {
		const { event } = makeEvent({ 'api-refresh-token': 'refresh-1' });
		vi.mocked(event.fetch).mockResolvedValue(refreshResponse(200));

		expect(await refreshAccessToken(event)).toEqual({ ok: true, expiresInMs: undefined });
	});

	test('should omit an expiration that has already passed', async () => {
		const { event } = makeEvent({ 'api-refresh-token': 'refresh-1' });
		const expiration = new Date(Date.now() - 1000).toISOString();
		vi.mocked(event.fetch).mockResolvedValue(
			refreshResponse(200, { access_expiration: expiration })
		);

		expect((await refreshAccessToken(event)).expiresInMs).toBeUndefined();
	});

	test('should fail when Django rejects the refresh token', async () => {
		const { event, store } = makeEvent({ 'api-refresh-token': 'expired' });
		vi.mocked(event.fetch).mockResolvedValue(refreshResponse(401));

		expect(await refreshAccessToken(event)).toEqual({ ok: false });
		expect(store['api-access-token']).toBeUndefined();
	});

	test('should fail without throwing when the backend is unreachable', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { event } = makeEvent({ 'api-refresh-token': 'refresh-1' });
		vi.mocked(event.fetch).mockRejectedValue(new Error('ECONNREFUSED'));

		expect(await refreshAccessToken(event)).toEqual({ ok: false });
	});

	test('should still succeed when the response body is not JSON', async () => {
		const { event } = makeEvent({ 'api-refresh-token': 'refresh-1' });
		vi.mocked(event.fetch).mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.reject(new Error('not json')),
			headers: { getSetCookie: () => [] }
		} as unknown as Response);

		expect(await refreshAccessToken(event)).toEqual({ ok: true, expiresInMs: undefined });
	});
});
