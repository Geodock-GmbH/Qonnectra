import type OlMap from 'ol/Map';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { zoomToExtent } from '$lib/map/searchUtils';
import { globalToaster } from '$lib/stores/toaster';
import { getLayerExtent } from '$lib/remote/map/layers.remote';

import { createZoomToLayerExtentHandler } from './zoomToLayerExtent';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/map/searchUtils', () => ({
	zoomToExtent: vi.fn()
}));

vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerExtent: vi.fn()
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { error: vi.fn(), success: vi.fn() }
}));

const mapStub = {} as OlMap;

afterEach(() => {
	vi.mocked(getLayerExtent).mockReset();
	vi.mocked(zoomToExtent).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('createZoomToLayerExtentHandler', () => {
	test('should fetch the layer extent and zoom the map to it', async () => {
		const extent = [1, 2, 3, 4];
		vi.mocked(getLayerExtent).mockResolvedValue({ extent, layer: 'trench' } as never);

		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(getLayerExtent).toHaveBeenCalledWith({ layerType: 'trench', projectId: 'proj-1' });
		expect(zoomToExtent).toHaveBeenCalledWith(mapStub, extent);
	});

	test('should do nothing when the map is not ready', async () => {
		const handler = createZoomToLayerExtentHandler(
			() => undefined,
			() => 'proj-1'
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(getLayerExtent).not.toHaveBeenCalled();
	});

	test('should do nothing without a project id', async () => {
		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => ''
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(getLayerExtent).not.toHaveBeenCalled();
	});

	test('should do nothing for a layer the backend cannot measure', async () => {
		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await handler({ layerId: 'wms-layer', layerType: null });
		await handler({ layerId: 'conduit-layer', layerType: 'conduit' });

		expect(getLayerExtent).not.toHaveBeenCalled();
	});

	test('should not zoom when the layer is empty', async () => {
		vi.mocked(getLayerExtent).mockResolvedValue({ extent: null, layer: 'trench' } as never);

		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await handler({ layerId: 'trench-layer', layerType: 'trench' });

		expect(zoomToExtent).not.toHaveBeenCalled();
	});

	test('should toast the failure and not zoom when the request fails', async () => {
		vi.mocked(getLayerExtent).mockRejectedValue(new Error('offline') as never);

		const handler = createZoomToLayerExtentHandler(
			() => mapStub,
			() => 'proj-1'
		);
		await expect(
			handler({ layerId: 'trench-layer', layerType: 'trench' })
		).resolves.toBeUndefined();

		expect(zoomToExtent).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledTimes(1);
	});
});
