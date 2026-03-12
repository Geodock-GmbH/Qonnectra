// frontend/src/lib/map/tileSources.js
import { PUBLIC_API_URL } from '$env/static/public';
import MVT from 'ol/format/MVT.js';
import VectorTileSource from 'ol/source/VectorTile.js';

import { reconstructFeatures } from './featureReconstructor.js';
import { tileLoadingManager } from './tileLoadingManager.js';
import { getWorkerPool } from './workerPool.js';

/**
 * @typedef {(title: string, message: string) => void} ErrorCallback
 */

/** @type {number} */
let requestCounter = 0;

/**
 * Generates a unique request ID for tile loading operations.
 * @returns {string} Unique request identifier combining timestamp and counter
 */
function generateRequestId() {
	return `tile-${Date.now()}-${requestCounter++}`;
}

/**
 * Creates a tile load function with AbortController support and worker-based parsing.
 * @param {string} layerType - Layer type identifier for error messages (e.g., 'trench', 'node')
 * @param {ErrorCallback | undefined} onError - Optional callback invoked on load errors
 * @returns {import('ol/Tile').LoadFunction} Tile load function for VectorTileSource
 */
function createTileLoadFunction(layerType, onError) {
	return (tile, url) => {
		if (!url) {
			tile.setState(4);
			return;
		}

		if (tileLoadingManager.isLoadingPaused()) {
			tile.setState(4);
			return;
		}

		tile.setLoader((extent, resolution, projection) => {
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
				.then((response) => {
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
				.catch((error) => {
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
 * @param {import('ol/VectorTile').default} tile - Vector tile to populate
 * @param {ArrayBuffer} data - Raw MVT tile data
 * @param {import('ol/extent').Extent} extent - Tile extent in target projection
 * @param {import('ol/proj/Projection').default | string} projection - Target projection
 */
function fallbackParse(tile, data, extent, projection) {
	const format = tile.getFormat();
	const features = format.readFeatures(data, {
		extent: extent,
		featureProjection: projection
	});
	tile.setFeatures(features);
}

/**
 * Creates a vector tile source for trench features.
 * @param {string} selectedProject - Project ID to filter tiles by
 * @param {ErrorCallback | undefined} onError - Optional callback for load errors
 * @param {boolean} [isGlobalView=false] - When true, loads tiles without project filter
 * @returns {VectorTileSource} Configured vector tile source for trenches
 */
export function createTrenchTileSource(selectedProject, onError, isGlobalView = false) {
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
 * @param {string} selectedProject - Project ID to filter tiles by
 * @param {ErrorCallback | undefined} onError - Optional callback for load errors
 * @param {boolean} [isGlobalView=false] - When true, loads tiles without project filter
 * @returns {VectorTileSource} Configured vector tile source for addresses
 */
export function createAddressTileSource(selectedProject, onError, isGlobalView = false) {
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
 * @param {string} selectedProject - Project ID to filter tiles by
 * @param {ErrorCallback | undefined} onError - Optional callback for load errors
 * @param {boolean} [isGlobalView=false] - When true, loads tiles without project filter
 * @returns {VectorTileSource} Configured vector tile source for nodes
 */
export function createNodeTileSource(selectedProject, onError, isGlobalView = false) {
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
 * @param {string} selectedProject - Project ID to filter tiles by
 * @param {ErrorCallback | undefined} onError - Optional callback for load errors
 * @param {boolean} [isGlobalView=false] - When true, loads tiles without project filter
 * @returns {VectorTileSource} Configured vector tile source for areas
 */
export function createAreaTileSource(selectedProject, onError, isGlobalView = false) {
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
