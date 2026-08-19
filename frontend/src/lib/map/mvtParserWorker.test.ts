import { beforeAll, describe, expect, test, vi } from 'vitest';

const postMessageMock = vi.fn();

const workerScope: {
	onmessage: ((e: MessageEvent) => void) | null;
	postMessage: typeof postMessageMock;
} = {
	onmessage: null,
	postMessage: postMessageMock
};

vi.stubGlobal('self', workerScope);

beforeAll(async () => {
	await import('./mvtParserWorker');
});

function parse(data: ArrayBuffer) {
	postMessageMock.mockClear();
	workerScope.onmessage?.({
		data: {
			requestId: 'req-1',
			data,
			extent: [0, 0, 4096, 4096],
			projection: 'EPSG:3857'
		}
	} as MessageEvent);
	return postMessageMock.mock.calls[0][0];
}

describe('mvtParserWorker', () => {
	test('should register an onmessage handler', () => {
		expect(workerScope.onmessage).toBeTypeOf('function');
	});

	test('should respond with serialized features for an empty tile', () => {
		const response = parse(new ArrayBuffer(0));

		expect(response).toEqual({
			requestId: 'req-1',
			success: true,
			features: []
		});
	});

	test('should respond with an error for malformed tile data', () => {
		const garbage = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]).buffer;

		const response = parse(garbage);

		expect(response.requestId).toBe('req-1');
		expect(response.success).toBe(false);
		expect(response.error).toBeTypeOf('string');
	});
});
