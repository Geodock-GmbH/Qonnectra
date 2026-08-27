import type OlMap from 'ol/Map';
import { deserialize } from '$app/forms';

import { zoomToExtent } from '$lib/map/searchUtils';

/**
 * Creates a handler function that zooms the map to a layer's full extent.
 * Fetches the extent from the server via a form action and delegates to {@link zoomToExtent}.
 */
export function createZoomToLayerExtentHandler(
	getMap: () => OlMap | undefined,
	getProjectId: () => string
): (event: { layerId: string; layerType: string | null }) => Promise<void> {
	return async function handleZoomToExtent({ layerId, layerType }) {
		const map = getMap();
		const projectId = getProjectId();

		if (!map || !projectId) return;

		try {
			const formData = new FormData();
			formData.append('layerType', String(layerType));
			formData.append('projectId', projectId);

			const response = await fetch('?/getLayerExtent', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			if (result.type === 'success' && result.data?.extent) {
				zoomToExtent(map, result.data.extent as number[]);
			}
		} catch (error) {
			console.error('Error zooming to layer extent:', error);
		}
	};
}
