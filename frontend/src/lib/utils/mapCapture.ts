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
 * @param container - Element holding the map's layer canvases.
 * @param aspectRatio - Height / width to center-crop the result to, so a frame of that
 *   shape shows the map undistorted whatever the container's shape; omitted keeps the full canvas.
 * @returns The merged image as a PNG data URL, or null when the container has no canvas.
 */
export function captureMapCanvases(container: HTMLElement, aspectRatio?: number): string | null {
	const canvases = container.querySelectorAll('canvas');
	if (canvases.length === 0) return null;

	const { width, height } = canvases[0];
	let cropWidth = width;
	let cropHeight = height;
	if (aspectRatio) {
		if (height / width > aspectRatio) cropHeight = Math.round(width * aspectRatio);
		else cropWidth = Math.round(height / aspectRatio);
	}
	const offsetX = (width - cropWidth) / 2;
	const offsetY = (height - cropHeight) / 2;

	const mergedCanvas = document.createElement('canvas');
	mergedCanvas.width = cropWidth;
	mergedCanvas.height = cropHeight;
	const ctx = mergedCanvas.getContext('2d') as CanvasRenderingContext2D;

	for (const canvas of canvases) {
		ctx.drawImage(canvas, offsetX, offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
	}

	return mergedCanvas.toDataURL('image/png');
}

/**
 * Collects attributions from visible WMS layers for PDF rendering.
 * @param projectId - Project whose persisted layer visibility decides which sources count.
 * @returns Unique attribution strings of active sources with at least one visible layer.
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
