import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	getMicroducts,
	getPipesInTrench,
	getTrenchesForConduit,
	getTrenchProfile,
	saveTrenchProfilePosition
} from './conduitData';

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

describe('getMicroducts', () => {
	test('should fetch microducts for a conduit', async () => {
		const fetchMock = okFetch({ microducts: [] });

		const result = await getMicroducts(fetchMock, mockCookies, 'pipe-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/microduct/all/?uuid_conduit=pipe-1',
			expect.objectContaining({ method: 'GET' })
		);
		expect(result).toEqual({ microducts: [] });
	});

	test('should fail without a pipe id', async () => {
		const result = await getMicroducts(vi.fn(), mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Pipe ID is required' } });
	});

	test('should fail with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getMicroducts(fetchMock, mockCookies, 'pipe-1');

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
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

describe('getTrenchProfile', () => {
	test('should fetch the trench profile', async () => {
		const fetchMock = okFetch({ conduits: [] });

		const result = await getTrenchProfile(fetchMock, mockCookies, 'trench-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/trench-conduit-canvas/profile/trench-1/',
			expect.objectContaining({ method: 'GET' })
		);
		expect(result).toEqual({ conduits: [] });
	});

	test('should fail without a trench uuid', async () => {
		const result = await getTrenchProfile(vi.fn(), mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Trench UUID is required' } });
	});
});

describe('saveTrenchProfilePosition', () => {
	test('should POST the canvas position for the conduit', async () => {
		const fetchMock = okFetch({ saved: true });

		const result = await saveTrenchProfilePosition(
			fetchMock,
			mockCookies,
			'trench-1',
			'conduit-1',
			10,
			20,
			100,
			50
		);

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('http://localhost:8000/trench-conduit-canvas/bulk-save/');
		expect(options.method).toBe('POST');
		expect(options.headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(options.body)).toEqual({
			trench: 'trench-1',
			positions: [
				{
					conduit: 'conduit-1',
					canvas_x: 10,
					canvas_y: 20,
					canvas_width: 100,
					canvas_height: 50
				}
			]
		});
		expect(result).toEqual({ saved: true });
	});

	test('should propagate backend errors', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });

		const result = await saveTrenchProfilePosition(
			fetchMock,
			mockCookies,
			'trench-1',
			'conduit-1',
			0,
			0,
			0,
			0
		);

		expect(result).toEqual({ status: 400, data: { error: 'Failed to save position' } });
	});
});
