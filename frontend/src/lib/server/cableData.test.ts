import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCablesInTrench } from './cableData';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: { error: string }) => ({ status, data })
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Cookie: 'api-access-token=mock-token' })
}));

const mockCookies = {} as Cookies;

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getCablesInTrench', () => {
	test('should fetch cables for a trench', async () => {
		const cables = { cables: [{ uuid: 'c1' }] };
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(cables)
		});

		const result = await getCablesInTrench(fetchMock, mockCookies, 'trench-1');

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/cable/in-trench/trench-1/', {
			method: 'GET',
			headers: { Cookie: 'api-access-token=mock-token' }
		});
		expect(result).toEqual(cables);
	});

	test('should fail without a trench UUID', async () => {
		const fetchMock = vi.fn();

		const result = await getCablesInTrench(fetchMock, mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Trench UUID is required' } });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should propagate the backend error status', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });

		const result = await getCablesInTrench(fetchMock, mockCookies, 'trench-1');

		expect(result).toEqual({ status: 404, data: { error: 'Failed to get cables in trench' } });
	});

	test('should fail with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getCablesInTrench(fetchMock, mockCookies, 'trench-1');

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
	});
});
