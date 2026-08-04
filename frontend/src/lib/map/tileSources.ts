import type { Extent } from 'ol/extent';
import type { FeatureLike } from 'ol/Feature';
import type Projection from 'ol/proj/Projection';
import type { LoadFunction } from 'ol/Tile';
import type VectorTile from 'ol/VectorTile';
import { invalidateAll } from '$app/navigation';
import { PUBLIC_API_URL } from '$env/static/public';
import MVT from 'ol/format/MVT.js';
import VectorTileSource from 'ol/source/VectorTile.js';

import { reconstructFeatures } from './featureReconstructor';
import { tileLoadingManager } from './tileLoadingManager';
import { getWorkerPool } from './workerPool';

export type ErrorCallback = (title: string, message: string) => void;

let requestCounter = 0;

/**
 * Generates a unique request ID for tile loading operations.
 */
function generateRequestId(): string {
	return `tile-${Date.now()}-${requestCounter++}`;
}

/**
 * Creates a tile load function with AbortController support and worker-based parsing.
 */
function createTileLoadFunction(
	layerType: string,
	onError: ErrorCallback | undefined
): LoadFunction {
	return (baseTile, url) => {
		const tile = baseTile as VectorTile<FeatureLike>;
		if (!url) {
			tile.setState(4);
			return;
		}

		if (tileLoadingManager.isLoadingPaused()) {
			tile.setState(4);
			return;
		}

		tile.setLoader((extent: Extent, resolution: number, projection: Projection) => {
			if (tileLoadingManager.isLoadingPaused()) {
				tile.setState(4);
				return;
			}

			const requestId = generateRequestId();
			const controller = tileLoadingManager.createAbortController(requestId);

			fetch(url, {
				credentials: 'include',
				signal: controller.signal
			})
				.then(async (response) => {
					if (response.status === 401) {
						await invalidateAll();
						const retry = await fetch(url, {
							credentials: 'include',
							signal: controller.signal
						});
						if (!retry.ok) {
							throw new Error(`Failed to load ${layerType} tile: ${retry.statusText}`);
						}
						return retry.arrayBuffer();
					}
					if (!response.ok) {
						throw new Error(`Failed to load ${layerType} tile: ${response.statusText}`);
					}
					return response.arrayBuffer();
				})
				.then(async (data) => {
					const workerPool = getWorkerPool();
					if (workerPool.workers.length > 0) {
						const result = await workerPool.parse(
							requestId,
							data,
							extent,
							typeof projection === 'string' ? projection : projection.getCode()
						);

						if (result.success && result.features) {
							const features = reconstructFeatures(result.features);
							tile.setFeatures(features);
						} else if (result.error !== 'Cancelled') {
							fallbackParse(tile, data, extent, projection);
						}
					} else {
						fallbackParse(tile, data, extent, projection);
					}
				})
				.catch((error: Error) => {
					if (error.name === 'AbortError') {
						tile.setState(4);
						return;
					}
					console.error(`Error loading ${layerType} vector tile:`, error);
					tile.setState(3);
					if (onError) {
						onError(
							`Error loading ${layerType} tile`,
							error.message || 'Could not fetch tile data.'
						);
					}
				})
				.finally(() => {
					tileLoadingManager.removeAbortController(requestId);
				});
		});
	};
}

/**
 * Parses MVT data on the main thread when worker pool is unavailable.
 */
function fallbackParse(
	tile: VectorTile<FeatureLike>,
	data: ArrayBuffer,
	extent: Extent,
	projection: Projection | string
): void {
	const format = tile.getFormat();
	const features = format.readFeatures(data, {
		extent: extent,
		featureProjection: projection
	});
	tile.setFeatures(features);
}

/**
 * Creates a vector tile source for trench features.
 */
export function createTrenchTileSource(
	selectedProject: string,
	onError: ErrorCallback | undefined,
	isGlobalView = false
): VectorTileSource {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			if (isGlobalView) {
				return `${PUBLIC_API_URL}ol_trench_tiles/${z}/${x}/${y}.mvt`;
			}
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_trench_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: createTileLoadFunction('trench', onError)
	});
}

/**
 * Creates a vector tile source for address features.
 */
export function createAddressTileSource(
	selectedProject: string,
	onError: ErrorCallback | undefined,
	isGlobalView = false
): VectorTileSource {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			if (isGlobalView) {
				return `${PUBLIC_API_URL}ol_address_tiles/${z}/${x}/${y}.mvt`;
			}
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_address_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: createTileLoadFunction('address', onError)
	});
}

/**
 * Creates a vector tile source for node features.
 */
export function createNodeTileSource(
	selectedProject: string,
	onError: ErrorCallback | undefined,
	isGlobalView = false
): VectorTileSource {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			if (isGlobalView) {
				return `${PUBLIC_API_URL}ol_node_tiles/${z}/${x}/${y}.mvt`;
			}
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_node_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: createTileLoadFunction('node', onError)
	});
}

/**
 * Creates a vector tile source for area (polygon) features.
 */
export function createAreaTileSource(
	selectedProject: string,
	onError: ErrorCallback | undefined,
	isGlobalView = false
): VectorTileSource {
	return new VectorTileSource({
		format: new MVT({
			idProperty: 'uuid'
		}),
		tileUrlFunction: (tileCoord) => {
			const [z, x, y] = tileCoord;
			if (isGlobalView) {
				return `${PUBLIC_API_URL}ol_area_tiles/${z}/${x}/${y}.mvt`;
			}
			const projectId = parseInt(selectedProject, 10);
			if (isNaN(projectId)) {
				return undefined;
			}
			return `${PUBLIC_API_URL}ol_area_tiles/${z}/${x}/${y}.mvt?project=${projectId}`;
		},
		tileLoadFunction: createTileLoadFunction('area', onError)
	});
}
