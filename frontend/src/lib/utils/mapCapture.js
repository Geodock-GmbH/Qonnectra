import { get } from 'svelte/store';

import { getWMSLayerVisibility, wmsLayerVisibilityConfig, wmsSourcesData } from '$lib/stores/store';

/**
 * Merges all OpenLayers canvases inside a container into a single PNG data URL.
 * @param {HTMLElement} container - The map container element.
 * @returns {string | null} Base64 PNG data URL, or null if no canvases found.
 */
export function captureMapCanvases(container) {
	const canvases = container.querySelectorAll('canvas');
	if (canvases.length === 0) return null;

	const firstCanvas = canvases[0];
	const mergedCanvas = document.createElement('canvas');
	mergedCanvas.width = firstCanvas.width;
	mergedCanvas.height = firstCanvas.height;
	const ctx = /** @type {CanvasRenderingContext2D} */ (mergedCanvas.getContext('2d'));

	for (const canvas of canvases) {
		ctx.drawImage(canvas, 0, 0);
	}

	return mergedCanvas.toDataURL('image/png');
}

/**
 * Collects attributions from visible WMS layers for PDF rendering.
 * @param {string} projectId - The project ID for visibility lookup.
 * @returns {string[]} Unique attribution strings.
 */
export function getVisibleWMSAttributions(projectId) {
	const { sources, loaded } = get(wmsSourcesData);
	if (!loaded || !sources) return [];

	const visibilityConfig = get(wmsLayerVisibilityConfig);
	const attributions = new Set();

	for (const source of /** @type {any[]} */ (sources)) {
		if (!source.is_active || !source.attribution) continue;

		for (const layer of source.layers) {
			if (!layer.is_enabled) continue;

			const layerId = `wms-${source.id}-${layer.name}`;
			const isVisible = getWMSLayerVisibility(visibilityConfig, projectId, layerId, true);

			if (isVisible) {
				attributions.add(source.attribution);
				break;
			}
		}
	}

	return [...attributions];
}
