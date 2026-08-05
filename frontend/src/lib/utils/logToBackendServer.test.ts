import type { Cookies } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { logToBackendServer } from './logToBackendServer';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://mock-backend.test/'
}));

const fetchMock = vi.fn();

function makeCookies(values: Record<string, string>): Cookies {
	return { get: (name: string) => values[name] } as unknown as Cookies;
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('logToBackendServer', () => {
	test('should POST the log entry with auth headers from cookies', async () => {
		fetchMock.mockResolvedValue({ ok: true });

		const result = await logToBackendServer({
			level: 'INFO',
			message: 'Page loaded',
			path: '/dashboard',
			cookies: makeCookies({ 'api-access-token': 'tok-1' })
		});

		expect(result).toEqual({ success: true });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('http://mock-backend.test/logs/');
		expect(options.method).toBe('POST');
		expect(options.headers.get('Cookie')).toBe('api-access-token=tok-1');
		expect(options.headers.get('Content-Type')).toBe('application/json');
		expect(JSON.parse(options.body)).toEqual({
			level: 'INFO',
			message: 'Page loaded',
			path: '/dashboard',
			extra_data: {},
			project: null
		});
	});

	test('should return the error text on a non-ok response', async () => {
		fetchMock.mockResolvedValue({ ok: false, text: () => Promise.resolve('denied') });

		const result = await logToBackendServer({
			level: 'ERROR',
			message: 'x',
			path: '/y',
			cookies: makeCookies({})
		});

		expect(result).toEqual({ success: false, error: 'denied' });
	});

	test('should catch network errors and report them', async () => {
		fetchMock.mockRejectedValue(new Error('backend down'));

		const result = await logToBackendServer({
			level: 'ERROR',
			message: 'x',
			path: '/y',
			cookies: makeCookies({})
		});

		expect(result).toEqual({ success: false, error: 'backend down' });
	});
});
