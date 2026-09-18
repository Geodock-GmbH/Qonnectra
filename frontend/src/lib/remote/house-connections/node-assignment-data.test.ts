import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { setMicroductNode } from './node-assignment-data';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

const headers = { Cookie: 'api-access-token=mock-token', 'Content-Type': 'application/json' };
const fetchMock = vi.fn();

function okResponse(data: unknown) {
	return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function failedResponse(status: number, data: unknown = {}) {
	return { ok: false, status, json: () => Promise.resolve(data) };
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
});

describe('setMicroductNode', () => {
	test('should patch the microduct with the node uuid', async () => {
		const microduct = { uuid: 'md-1', number: 1 };
		fetchMock.mockResolvedValue(okResponse(microduct));

		const result = await setMicroductNode(headers, 'md-1', 'node-1', 'Failed to assign node');

		expect(result).toEqual(microduct);
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/microduct/md-1/', {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ uuid_node_id: 'node-1' })
		});
	});

	test('should send a null node to unassign', async () => {
		fetchMock.mockResolvedValue(okResponse({ uuid: 'md-1' }));

		await setMicroductNode(headers, 'md-1', null, 'Failed to remove node');

		expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ uuid_node_id: null }));
	});

	test('should escape the microduct uuid in the url', async () => {
		fetchMock.mockResolvedValue(okResponse({ uuid: 'md/1' }));

		await setMicroductNode(headers, 'md/1', 'node-1', 'Failed to assign node');

		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/microduct/md%2F1/');
	});

	test('should fail with the backend detail', async () => {
		fetchMock.mockResolvedValue(failedResponse(400, { detail: 'Node already connected.' }));

		await expect(
			setMicroductNode(headers, 'md-1', 'node-1', 'Failed to assign node')
		).rejects.toMatchObject({ status: 400, body: { message: 'Node already connected.' } });
	});

	test('should fall back to the given message when the backend gives no reason', async () => {
		fetchMock.mockResolvedValue(failedResponse(500));

		await expect(
			setMicroductNode(headers, 'md-1', null, 'Failed to remove node')
		).rejects.toMatchObject({ status: 500, body: { message: 'Failed to remove node' } });
	});
});
