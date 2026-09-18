import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createConnectionBatch, toBranchConnections } from './connection-data';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

const headers = { Cookie: 'api-access-token=mock-token', 'Content-Type': 'application/json' };
const fetchMock = vi.fn();

function okResponse(data: unknown) {
	return { ok: true, status: 201, json: () => Promise.resolve(data) };
}

function failedResponse(status: number, data: unknown = {}) {
	return { ok: false, status, json: () => Promise.resolve(data) };
}

const pairA = {
	from: { microductUuid: 'md-1', trenchUuid: 'trench-1' },
	to: { microductUuid: 'md-2', trenchUuid: 'trench-2' }
};
const pairB = {
	from: { microductUuid: 'md-3', trenchUuid: 'trench-1' },
	to: { microductUuid: 'md-4', trenchUuid: 'trench-2' }
};

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe('toBranchConnections', () => {
	test('should keep only the uuids of both connection ends', () => {
		const result = toBranchConnections([
			{
				uuid: 'conn-1',
				uuid_microduct_from: { uuid: 'md-1', number: 1, uuid_conduit: { uuid: 'conduit-1' } },
				uuid_trench_from: { id: 'trench-1', type: 'Feature', geometry: { type: 'LineString' } },
				uuid_microduct_to: { uuid: 'md-2', number: 1 },
				uuid_trench_to: { id: 'trench-2', type: 'Feature' },
				uuid_node: { id: 'node-1' }
			}
		]);

		expect(result).toEqual([{ uuid: 'conn-1', ...pairA }]);
	});

	test('should drop rows that miss an end', () => {
		const result = toBranchConnections([
			{ uuid: 'conn-1', uuid_microduct_from: { uuid: 'md-1' }, uuid_trench_from: { id: 't-1' } },
			{ uuid: 'conn-2' },
			null
		]);

		expect(result).toEqual([]);
	});

	test.each([null, undefined, {}, 'connections'])(
		'should return no connections for the unexpected payload %j',
		(payload) => {
			expect(toBranchConnections(payload)).toEqual([]);
		}
	);
});

describe('createConnectionBatch', () => {
	test('should post every pair with the node it is joined at', async () => {
		fetchMock.mockResolvedValue(okResponse({ uuid: 'conn-1' }));

		const result = await createConnectionBatch(headers, 'node-1', [pairA, pairB]);

		expect(result).toEqual({ created: 2, errors: [] });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:8000/microduct_connection/', {
			method: 'POST',
			headers,
			body: JSON.stringify({
				uuid_microduct_from_id: 'md-1',
				uuid_microduct_to_id: 'md-2',
				uuid_node_id: 'node-1',
				uuid_trench_from_id: 'trench-1',
				uuid_trench_to_id: 'trench-2'
			})
		});
	});

	test('should keep going after a rejected pair and report its reason', async () => {
		fetchMock
			.mockResolvedValueOnce(failedResponse(400, { detail: 'Microduct already connected.' }))
			.mockResolvedValueOnce(okResponse({ uuid: 'conn-2' }));

		const result = await createConnectionBatch(headers, 'node-1', [pairA, pairB]);

		expect(result).toEqual({ created: 1, errors: ['Microduct already connected.'] });
	});

	test('should report a rejection without a reason as null', async () => {
		fetchMock.mockResolvedValue(failedResponse(500));

		const result = await createConnectionBatch(headers, 'node-1', [pairA]);

		expect(result).toEqual({ created: 0, errors: [null] });
	});

	test('should count a pair the backend could not be reached for as failed and carry on', async () => {
		fetchMock
			.mockRejectedValueOnce(new TypeError('fetch failed'))
			.mockResolvedValueOnce(okResponse({ uuid: 'conn-2' }));

		const result = await createConnectionBatch(headers, 'node-1', [pairA, pairB]);

		expect(result).toEqual({ created: 1, errors: [null] });
	});

	test('should not call the backend for an empty batch', async () => {
		const result = await createConnectionBatch(headers, 'node-1', []);

		expect(result).toEqual({ created: 0, errors: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
