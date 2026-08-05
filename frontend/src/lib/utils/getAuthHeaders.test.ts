import type { Cookies } from '@sveltejs/kit';
import { describe, expect, test } from 'vitest';

import { getAuthHeaders } from './getAuthHeaders';

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
