import type { Cookies } from '@sveltejs/kit';
import { describe, expect, test } from 'vitest';

import { getAuthHeaders, getRefreshTokenHeaders } from './getAuthHeaders';

function makeCookies(values: Record<string, string>): Cookies {
	return { get: (name: string) => values[name] } as unknown as Cookies;
}

describe('getAuthHeaders', () => {
	test('should build a Cookie header from the access token', () => {
		const cookies = makeCookies({ 'api-access-token': 'token-123' });
		expect(getAuthHeaders(cookies)).toEqual({ Cookie: 'api-access-token=token-123' });
	});

	test('should return an empty object when the token cookie is missing', () => {
		expect(getAuthHeaders(makeCookies({}))).toEqual({});
	});

	test('should return an empty object for null cookies', () => {
		expect(getAuthHeaders(null)).toEqual({});
	});
});

describe('getRefreshTokenHeaders', () => {
	test('should return the refresh token as a Cookie header', () => {
		const cookies = { get: (name: string) => (name === 'api-refresh-token' ? 'r1' : undefined) };
		expect(getRefreshTokenHeaders(cookies as unknown as Cookies)).toEqual({
			Cookie: 'api-refresh-token=r1'
		});
	});

	test('should return an empty object without a refresh token', () => {
		const cookies = { get: () => undefined };
		expect(getRefreshTokenHeaders(cookies as unknown as Cookies)).toEqual({});
		expect(getRefreshTokenHeaders(null)).toEqual({});
	});
});
