import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	clearAuthCookies,
	ensureSelectedProjectCookie,
	forwardSetCookies,
	loginErrorMessage,
	logoutHeaders,
	safeRedirectTarget
} from './auth-session';

function makeCookies(store: Record<string, string> = {}) {
	return {
		get: vi.fn((name: string) => store[name]),
		set: vi.fn(),
		delete: vi.fn()
	} as unknown as Cookies & { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
}

describe('forwardSetCookies', () => {
	let cookies: ReturnType<typeof makeCookies>;

	beforeEach(() => {
		cookies = makeCookies();
	});

	test('sets every parsed cookie with its attributes', () => {
		forwardSetCookies(
			cookies,
			[
				'api-access-token=abc; Path=/; HttpOnly; Secure; SameSite=Lax',
				'api-refresh-token=def; Path=/auth; Domain=example.org'
			],
			false
		);

		expect(cookies.set).toHaveBeenCalledWith('api-access-token', 'abc', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		expect(cookies.set).toHaveBeenCalledWith('api-refresh-token', 'def', {
			path: '/auth',
			httpOnly: false,
			secure: false,
			sameSite: 'lax',
			domain: 'example.org'
		});
	});

	test('forces the secure flag when requested', () => {
		forwardSetCookies(cookies, ['api-access-token=abc; Path=/'], true);

		expect(cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'abc',
			expect.objectContaining({ secure: true })
		);
	});

	test('passes an expiry through as a Date', () => {
		forwardSetCookies(
			cookies,
			['api-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
			false
		);

		expect(cookies.set).toHaveBeenCalledWith(
			'api-access-token',
			'',
			expect.objectContaining({ expires: new Date(0) })
		);
	});

	test('does nothing for an empty header list', () => {
		forwardSetCookies(cookies, [], false);

		expect(cookies.set).not.toHaveBeenCalled();
	});
});

describe('clearAuthCookies', () => {
	test('deletes both token cookies on the root path', () => {
		const cookies = makeCookies();

		clearAuthCookies(cookies);

		expect(cookies.delete).toHaveBeenCalledWith('api-access-token', { path: '/' });
		expect(cookies.delete).toHaveBeenCalledWith('api-refresh-token', { path: '/' });
	});
});

describe('ensureSelectedProjectCookie', () => {
	test('sets the default project when none is selected', () => {
		const cookies = makeCookies();

		ensureSelectedProjectCookie(cookies, true);

		expect(cookies.set).toHaveBeenCalledWith('selected-project', '1', {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			httpOnly: false,
			secure: true,
			sameSite: 'lax'
		});
	});

	test('keeps an existing selection', () => {
		const cookies = makeCookies({ 'selected-project': '5' });

		ensureSelectedProjectCookie(cookies, false);

		expect(cookies.set).not.toHaveBeenCalled();
	});
});

describe('logoutHeaders', () => {
	test('includes the csrf token and refresh cookie when present', () => {
		const cookies = makeCookies({ csrftoken: 'csrf', 'api-refresh-token': 'refresh' });

		expect(logoutHeaders(cookies)).toEqual({
			'Content-Type': 'application/json',
			'X-CSRFToken': 'csrf',
			Cookie: 'api-refresh-token=refresh'
		});
	});

	test('omits the optional headers when the cookies are missing', () => {
		expect(logoutHeaders(makeCookies())).toEqual({ 'Content-Type': 'application/json' });
	});
});

describe('loginErrorMessage', () => {
	test('prefers the first non-field error', () => {
		expect(loginErrorMessage({ non_field_errors: ['Unable to log in.'], detail: 'ignored' })).toBe(
			'Unable to log in.'
		);
	});

	test('falls back to detail', () => {
		expect(loginErrorMessage({ detail: 'Internal server error' })).toBe('Internal server error');
	});

	test('falls back to the generic message for unusable bodies', () => {
		const fallback = 'Login failed. Please check your credentials.';

		expect(loginErrorMessage({})).toBe(fallback);
		expect(loginErrorMessage(null)).toBe(fallback);
		expect(loginErrorMessage('nope')).toBe(fallback);
		expect(loginErrorMessage({ non_field_errors: [] })).toBe(fallback);
	});
});

describe('safeRedirectTarget', () => {
	test('accepts absolute paths', () => {
		expect(safeRedirectTarget('/dashboard')).toBe('/dashboard');
		expect(safeRedirectTarget('/map/3?x=1')).toBe('/map/3?x=1');
	});

	test('rejects external and protocol-relative targets', () => {
		expect(safeRedirectTarget('https://evil.example')).toBe('/');
		expect(safeRedirectTarget('//evil.example')).toBe('/');
		expect(safeRedirectTarget('')).toBe('/');
		expect(safeRedirectTarget(undefined)).toBe('/');
	});
});
