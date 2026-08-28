import RenderFeature from 'ol/render/Feature.js';
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

let serializeFeature: typeof import('./mvtParserWorker').serializeFeature;

beforeAll(async () => {
	// Imported dynamically so the module's `self.onmessage = ...` runs after the
	// stubbed worker scope above exists.
	({ serializeFeature } = await import('./mvtParserWorker'));
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

// MVT's default RenderFeature has no getGeometryName()/getLayout(); the previous
// implementation called both and threw on every non-empty tile. The tile-level
// tests above never caught this because empty/garbage tiles never reach a real
// feature. These build genuine RenderFeatures — exactly as ol/format/MVT does
// (stride 2) — so they fail loudly if the serialization touches a phantom method.
describe('serializeFeature', () => {
	test('serializes a Point RenderFeature without calling phantom methods', () => {
		const feature = new RenderFeature('Point', [10, 20], [], 2, { name: 'node-a' }, 'id-1');

		const result = serializeFeature(feature);

		expect(result).toMatchObject({
			id: 'id-1',
			properties: { name: 'node-a' },
			flatCoordinates: [10, 20],
			geometryLayout: 'XY',
			geometryType: 'Point'
		});
	});

	test('maps a null ends (from getEnds) to undefined', () => {
		// RenderFeature stores `ends || null`, so a null ends must not leak through.
		const feature = new RenderFeature('Point', [1, 2], null as unknown as number[], 2, {}, 1);

		expect(serializeFeature(feature).ends).toBeUndefined();
	});

	test('preserves polygon ring boundaries via ends', () => {
		const flat = [0, 0, 4, 0, 4, 4, 0, 4, 0, 0];
		const feature = new RenderFeature('Polygon', flat, [10], 2, {}, 42);

		const result = serializeFeature(feature);

		expect(result.geometryType).toBe('Polygon');
		expect(result.flatCoordinates).toEqual(flat);
		expect(result.ends).toEqual([10]);
		expect(result.geometryLayout).toBe('XY');
	});
});
