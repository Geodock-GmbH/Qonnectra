import { deserialize } from '$app/forms';

import { zoomToExtent } from '$lib/map/searchUtils';

/**
 * Creates a handler function for zooming to layer extent
 * @param {() => import('ol/Map').default|undefined} getMap - Function that returns the OpenLayers map instance
 * @param {() => string} getProjectId - Function that returns the current project ID
 * @returns {Function} Handler function for zoom to extent events
 */
export function createZoomToLayerExtentHandler(getMap, getProjectId) {
	/**
	 * Handle zoom to layer extent request from LayerVisibilityTree
	 * @param {{layerId: string, layerType: string}} event - Layer info
	 */
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
				zoomToExtent(map, result.data.extent);
			}
		} catch (error) {
			console.error('Error zooming to layer extent:', error);
		}
	};
}
