import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	createConnection,
	deleteConnection,
	fetchTrenchConnections,
	mapTrenchConnections,
	newTrenchUuids
} from './connection-data';

vi.mock('$env/static/private', () => ({ API_URL: 'http://api.test/' }));

const headers = { Cookie: 'api-access-token=token' };
const fetchMock = vi.fn();

/**
 * Builds a minimal fetch response.
 * @param body - Parsed JSON body.
 * @param status - HTTP status.
 */
function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body)
	} as Response;
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

describe('mapTrenchConnections', () => {
	test('reduces the nested trench feature to a lean row', () => {
		const rows = mapTrenchConnections([
			{
				uuid: 'connection-1',
				trench: { id: 'trench-1', properties: { id_trench: 'T-100' }, geometry: { type: 'x' } }
			}
		]);

		expect(rows).toEqual([{ uuid: 'connection-1', trenchUuid: 'trench-1', label: 'T-100' }]);
	});

	test('keeps a connection whose trench has no label', () => {
		const rows = mapTrenchConnections([{ uuid: 'connection-1', trench: { id: 'trench-1' } }]);

		expect(rows).toEqual([{ uuid: 'connection-1', trenchUuid: 'trench-1', label: '' }]);
	});

	test('drops rows without a connection or trench uuid', () => {
		const rows = mapTrenchConnections([
			{ uuid: 'connection-1' },
			{ trench: { id: 'trench-2' } },
			null,
			'junk'
		]);

		expect(rows).toEqual([]);
	});

	test('returns an empty list for a non-array body', () => {
		expect(mapTrenchConnections({ detail: 'nope' })).toEqual([]);
	});
});

describe('newTrenchUuids', () => {
	const existing = [{ uuid: 'connection-1', trenchUuid: 'trench-1', label: 'T-1' }];

	test('keeps only trenches the conduit is not connected to yet', () => {
		expect(newTrenchUuids(existing, ['trench-1', 'trench-2'])).toEqual(['trench-2']);
	});

	test('collapses duplicates in the request', () => {
		expect(newTrenchUuids(existing, ['trench-2', 'trench-2'])).toEqual(['trench-2']);
	});
});

describe('fetchTrenchConnections', () => {
	test('requests the connections of the conduit and maps them', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse([
				{ uuid: 'connection-1', trench: { id: 'trench-1', properties: { id_trench: 'T-1' } } }
			])
		);

		const rows = await fetchTrenchConnections(headers, 'conduit 1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://api.test/trench_conduit_connection/all/?uuid_conduit=conduit%201',
			{ headers }
		);
		expect(rows).toEqual([{ uuid: 'connection-1', trenchUuid: 'trench-1', label: 'T-1' }]);
	});

	test('raises an HttpError carrying the backend detail', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'Forbidden' }, 403));

		await expect(fetchTrenchConnections(headers, 'conduit-1')).rejects.toMatchObject({
			status: 403,
			body: { message: 'Forbidden' }
		});
	});
});

describe('createConnection', () => {
	test('posts the conduit/trench pair', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ uuid: 'connection-9' }, 201));

		await createConnection(headers, 'conduit-1', 'trench-1');

		expect(fetchMock).toHaveBeenCalledWith('http://api.test/trench_conduit_connection/', {
			method: 'POST',
			headers,
			body: JSON.stringify({ uuid_conduit: 'conduit-1', uuid_trench: 'trench-1' })
		});
	});

	test('raises an HttpError when the backend rejects the pair', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ uuid_trench: ['Invalid pk'] }, 400));

		await expect(createConnection(headers, 'conduit-1', 'trench-1')).rejects.toMatchObject({
			status: 400,
			body: { message: 'uuid_trench: Invalid pk' }
		});
	});
});

describe('deleteConnection', () => {
	test('deletes the connection by uuid', async () => {
		fetchMock.mockResolvedValue(jsonResponse(null, 204));

		await deleteConnection(headers, 'connection 1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://api.test/trench_conduit_connection/connection%201/',
			{ method: 'DELETE', headers }
		);
	});

	test('raises an HttpError when the delete fails', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not found.' }, 404));

		await expect(deleteConnection(headers, 'connection-1')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found.' }
		});
	});
});
