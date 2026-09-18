import type OlMap from 'ol/Map';

import { m } from '$lib/paraglide/messages';

import { zoomToExtent } from '$lib/map/searchUtils';
import { globalToaster } from '$lib/stores/toaster';
import { isExtentLayerType } from '$lib/remote/map/layer-data';
import { getLayerExtent } from '$lib/remote/map/layers.remote';
import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

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
		} catch (err) {
			globalToaster.error({
				title: m.message_zoom_to_extent_failed(),
				description: remoteErrorMessage(err) ?? m.message_zoom_to_extent_failed()
			});
		}
	};
}
