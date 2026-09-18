import type OlMap from 'ol/Map';

import { zoomToExtent } from '$lib/map/searchUtils';
import { isExtentLayerType } from '$lib/remote/map/layer-data';
import { getLayerExtent } from '$lib/remote/map/layers.remote';

/**
 * Creates a handler function that zooms the map to a layer's full extent.
 * Fetches the extent through the `getLayerExtent` query and delegates to {@link zoomToExtent}.
 */
export function createZoomToLayerExtentHandler(
	getMap: () => OlMap | undefined,
	getProjectId: () => string
): (event: { layerId: string; layerType: string | null }) => Promise<void> {
	return async function handleZoomToExtent({ layerType }) {
		const map = getMap();
		const projectId = getProjectId();

		if (!map || !projectId || !isExtentLayerType(layerType)) return;

		try {
			const { extent } = await getLayerExtent({ layerType, projectId });
			if (extent) zoomToExtent(map, extent);
		} catch (error) {
			console.error('Error zooming to layer extent:', error);
		}
	};
}
