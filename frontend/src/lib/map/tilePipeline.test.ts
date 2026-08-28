import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ParseSuccessResponse } from './mvtParserWorker';
import type RenderFeature from 'ol/render/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { reconstructFeatures } from './featureReconstructor';

const postMessageMock = vi.fn();
const workerScope: {
	onmessage: ((e: MessageEvent) => void) | null;
	postMessage: typeof postMessageMock;
} = {
	onmessage: null,
	postMessage: postMessageMock
};

// The worker module registers `self.onmessage` at import time, so the worker
// scope must exist before the dynamic import below.
vi.stubGlobal('self', workerScope);

beforeAll(async () => {
	await import('./mvtParserWorker');
});

const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'__fixtures__',
	'node-tile-12-2140-1361.mvt'
);

/**
 * Runs tile data through the exact production path: worker-side MVT parse and
 * serialization via the onmessage handler, a structuredClone standing in for
 * the postMessage transfer, then main-thread reconstruction.
 */
function runPipeline(data: ArrayBuffer): RenderFeature[] {
	postMessageMock.mockClear();
	workerScope.onmessage?.({
		data: {
			requestId: 'pipeline-1',
			data,
			extent: [913289.5964806888, 6642920.759529339, 923073.6421195082, 6652704.805168159],
			projection: 'EPSG:3857'
		}
	} as MessageEvent);

	const response = postMessageMock.mock.calls[0][0] as ParseSuccessResponse;
	expect(response.success).toBe(true);
	return reconstructFeatures(structuredClone(response.features ?? []));
}

// Regression tests for the two breakages introduced when the worker parse path
// started succeeding (commit 01e0eb8): tiles carried plain ol/Feature objects
// without ids, which broke RenderFeature-consuming style code
// (feature.getExtent is not a function) and made every feature click look like
// an empty-map click (getId() === undefined -> no drawer).
describe('worker tile pipeline', () => {
	let tileData: ArrayBuffer;

	beforeAll(() => {
		const buf = readFileSync(fixturePath);
		tileData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	});

	test('reconstructed features expose the RenderFeature geometry API', () => {
		const features = runPipeline(tileData);

		expect(features.length).toBeGreaterThan(0);
		for (const feature of features) {
			const extent = feature.getExtent();
			expect(extent).toHaveLength(4);
			expect(extent[0]).toBeLessThanOrEqual(extent[2]);
			expect(feature.getFlatCoordinates().length).toBeGreaterThan(0);
			expect(feature.getType()).toBeTruthy();
		}
	});

	test('reconstructed features carry the uuid as feature id, like the fallback parse', () => {
		const features = runPipeline(tileData);

		for (const feature of features) {
			// MapInteractionManager treats a click on a feature without id as an
			// empty click, so a missing id silently disables the feature drawer.
			expect(feature.getId()).toBeTruthy();
			// idProperty moves uuid out of the properties, exactly as the
			// MVT({ idProperty: 'uuid' }) formats in tileSources do.
			expect(feature.get('uuid')).toBeUndefined();
		}
	});

	test('reconstructed features work with polygon intersection highlight styles', () => {
		const features = runPipeline(tileData);
		const [minX, minY, maxX, maxY] = features[0].getExtent();
		const pad = 10;
		const polygon = new Polygon([
			[
				[minX - pad, minY - pad],
				[maxX + pad, minY - pad],
				[maxX + pad, maxY + pad],
				[minX - pad, maxY + pad],
				[minX - pad, minY - pad]
			]
		]);

		// Mirrors InquiryDrawManager.featureIntersectsPolygons: extent pre-filter,
		// then coordinate sampling against the drawn polygon.
		const extent = features[0].getExtent();
		expect(polygon.intersectsExtent(extent)).toBe(true);
		const flat = features[0].getFlatCoordinates();
		expect(polygon.intersectsCoordinate([flat[0], flat[1]])).toBe(true);
	});
});
