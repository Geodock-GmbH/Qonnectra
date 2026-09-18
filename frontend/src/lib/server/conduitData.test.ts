import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPipesInTrench, getTrenchesForConduit } from './conduitData';

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

function okFetch(data: unknown) {
	return vi.fn().mockResolvedValue({
		ok: true,
		json: () => Promise.resolve(data)
	});
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getPipesInTrench', () => {
	test('should fetch pipes for a trench', async () => {
		const fetchMock = okFetch({ pipes: [] });

		const result = await getPipesInTrench(fetchMock, mockCookies, 'trench-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/trench_conduit_connection/all/?uuid_trench=trench-1',
			expect.objectContaining({ method: 'GET' })
		);
		expect(result).toEqual({ pipes: [] });
	});

	test('should fail without a trench id', async () => {
		const result = await getPipesInTrench(vi.fn(), mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Trench ID is required' } });
	});

	test('should propagate backend errors', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });

		const result = await getPipesInTrench(fetchMock, mockCookies, 'trench-1');

		expect(result).toEqual({ status: 403, data: { error: 'Failed to get pipes in trench' } });
	});
});

describe('getTrenchesForConduit', () => {
	test('should fetch trenches for a conduit', async () => {
		const fetchMock = okFetch({ trench_uuids: ['t1'] });

		const result = await getTrenchesForConduit(fetchMock, mockCookies, 'conduit-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/conduit/conduit-1/trenches/',
			expect.objectContaining({ method: 'GET' })
		);
		expect(result).toEqual({ trench_uuids: ['t1'] });
	});

	test('should fail without a conduit id', async () => {
		const result = await getTrenchesForConduit(vi.fn(), mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Conduit ID is required' } });
	});
});
