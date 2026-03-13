import { deserialize } from '$app/forms';

import { zoomToExtent } from '$lib/map/searchUtils';

/**
 * Creates a handler function that zooms the map to a layer's full extent.
 * Fetches the extent from the server via a form action and delegates to {@link zoomToExtent}.
 * @param {() => import('ol/Map').default | undefined} getMap - Returns the current OpenLayers map instance.
 * @param {() => string} getProjectId - Returns the current project ID.
 * @returns {(event: { layerId: string, layerType: string }) => Promise<void>} Handler for zoom-to-extent events.
 */
export function createZoomToLayerExtentHandler(getMap, getProjectId) {
	return async function handleZoomToExtent({ layerId, layerType }) {
		const map = getMap();
		const projectId = getProjectId();

		if (!map || !projectId) return;

		try {
			const formData = new FormData();
			formData.append('layerType', layerType);
			formData.append('projectId', projectId);

			const response = await fetch('?/getLayerExtent', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			if (result.type === 'success' && result.data?.extent) {
				zoomToExtent(map, /** @type {number[]} */ (result.data.extent));
			}
		} catch (error) {
			console.error('Error zooming to layer extent:', error);
		}
	};
}
