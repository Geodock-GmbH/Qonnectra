import { get } from 'svelte/store';

import { getWMSLayerVisibility, wmsLayerVisibilityConfig, wmsSourcesData } from '$lib/stores/store';

interface WMSLayer {
	name: string;
	is_enabled: boolean;
}

interface WMSSource {
	id: string;
	is_active: boolean;
	attribution?: string;
	layers: WMSLayer[];
}

/**
 * Merges all OpenLayers canvases inside a container into a single PNG data URL.
 */
export function captureMapCanvases(container: HTMLElement): string | null {
	const canvases = container.querySelectorAll('canvas');
	if (canvases.length === 0) return null;

	const firstCanvas = canvases[0];
	const mergedCanvas = document.createElement('canvas');
	mergedCanvas.width = firstCanvas.width;
	mergedCanvas.height = firstCanvas.height;
	const ctx = mergedCanvas.getContext('2d') as CanvasRenderingContext2D;

	for (const canvas of canvases) {
		ctx.drawImage(canvas, 0, 0);
	}

	return mergedCanvas.toDataURL('image/png');
}

/**
 * Collects attributions from visible WMS layers for PDF rendering.
 */
export function getVisibleWMSAttributions(projectId: string): string[] {
	const { sources, loaded } = get(wmsSourcesData);
	if (!loaded || !sources) return [];

	const visibilityConfig = get(wmsLayerVisibilityConfig);
	const attributions = new Set<string>();

	for (const source of sources as WMSSource[]) {
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
