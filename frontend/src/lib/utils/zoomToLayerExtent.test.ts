import type OlMap from 'ol/Map';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { zoomToExtent } from '$lib/map/searchUtils';

import { createZoomToLayerExtentHandler } from './zoomToLayerExtent';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$lib/map/searchUtils', () => ({
	zoomToExtent: vi.fn()
}));

const fetchMock = vi.fn();
const mapStub = {} as OlMap;

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	vi.mocked(zoomToExtent).mockClear();
});

describe('createZoomToLayerExtentHandler', () => {
	test('should fetch the layer extent and zoom the map to it', async () => {
		const extent = [1, 2, 3, 4];
		fetchMock.mockResolvedValue({
			text: () => Promise.resolve(JSON.stringify({ type: 'success', data: { extent } }))
		});

		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('?/getLayerExtent');
		expect(options.method).toBe('POST');
		expect(options.body.get('layerType')).toBe('trench');
		expect(options.body.get('projectId')).toBe('proj-1');
		expect(zoomToExtent).toHaveBeenCalledWith(mapStub, extent);
	});

	test('should do nothing when the map is not ready', async () => {
		const handler = createZoomToLayerExtentHandler(
			() => undefined,
			() => 'proj-1'
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should do nothing without a project id', async () => {
		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => ''
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should not zoom when the action fails', async () => {
		fetchMock.mockResolvedValue({
			text: () => Promise.resolve(JSON.stringify({ type: 'failure', status: 400 }))
		});

		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(zoomToExtent).not.toHaveBeenCalled();
	});

	test('should swallow network errors and not zoom', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		fetchMock.mockRejectedValue(new Error('offline'));

		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await expect(
			handler({ layerId: 'trench-layer', layerType: 'trench' })
		).resolves.toBeUndefined();

		expect(zoomToExtent).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
