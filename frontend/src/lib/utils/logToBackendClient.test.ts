import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { logToBackendClient } from './logToBackendClient';

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('logToBackendClient', () => {
	test('should POST the log entry to the frontend logs endpoint', async () => {
		fetchMock.mockResolvedValue({ ok: true });

		const result = await logToBackendClient({
			level: 'ERROR',
			message: 'Something failed',
			path: '/map',
			extraData: { code: 42 },
			project: 'proj-1'
		});

		expect(result).toEqual({ success: true });
		expect(fetchMock).toHaveBeenCalledWith('http://mock-api.test/logs/frontend/', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				level: 'ERROR',
				message: 'Something failed',
				path: '/map',
				extra_data: { code: 42 },
				project: 'proj-1'
			})
		});
	});

	test('should default extraData and project when omitted', async () => {
		fetchMock.mockResolvedValue({ ok: true });

		await logToBackendClient({ level: 'INFO', message: 'hi', path: '/x' });

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.extra_data).toEqual({});
		expect(body.project).toBeNull();
	});

	test('should fall back to "/" as path outside the browser', async () => {
		fetchMock.mockResolvedValue({ ok: true });

		await logToBackendClient({ level: 'INFO', message: 'hi' });

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.path).toBe('/');
	});

	test('should return the error text on a non-ok response', async () => {
		fetchMock.mockResolvedValue({ ok: false, text: () => Promise.resolve('nope') });

		const result = await logToBackendClient({ level: 'WARNING', message: 'x', path: '/y' });

		expect(result).toEqual({ success: false, error: 'nope' });
	});

	test('should catch network errors and report them', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));

		const result = await logToBackendClient({ level: 'CRITICAL', message: 'x', path: '/y' });

		expect(result).toEqual({ success: false, error: 'offline' });
	});
});
