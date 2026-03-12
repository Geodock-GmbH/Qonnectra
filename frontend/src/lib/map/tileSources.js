// frontend/src/lib/map/tileSources.js
import { PUBLIC_API_URL } from '$env/static/public';
import MVT from 'ol/format/MVT.js';
import VectorTileSource from 'ol/source/VectorTile.js';

import { reconstructFeatures } from './featureReconstructor.js';
import { tileLoadingManager } from './tileLoadingManager.js';
import { getWorkerPool } from './workerPool.js';

let requestCounter = 0;

/**
 * Generate unique request ID
 * @returns {string}
 */
function generateRequestId() {
	return `tile-${Date.now()}-${requestCounter++}`;
}

/**
 * Create tile load function with AbortController and worker parsing
 * @param {string} layerType - Type of layer for error messages
 * @param {(title: string, message: string) => void} onError - Error callback
 * @returns {import('ol/Tile').LoadFunction}
 */
function createTileLoadFunction(layerType, onError) {
	/** @type {import('ol/Tile').LoadFunction} */
	const loadFunction = (tile, url) => {
		const vectorTile = /** @type {import('ol/VectorTile').default<import('ol/render/Feature').default>} */ (tile);
		if (!url) {
			vectorTile.setState(4); // EMPTY
			return;
		}

		// Skip loading if navigation is in progress
		if (tileLoadingManager.isLoadingPaused()) {
			vectorTile.setState(4); // EMPTY
			return;
		}

		vectorTile.setLoader(
			/**
			 * @param {import('ol/extent').Extent} extent
			 * @param {number} resolution
			 * @param {import('ol/proj/Projection').default} projection
			 */
			(extent, resolution, projection) => {
				// Double-check pause state when loader executes
				if (tileLoadingManager.isLoadingPaused()) {
					vectorTile.setState(4); // EMPTY
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
						// Try worker parsing first
						const workerPool = getWorkerPool();
						if (workerPool.workers.length > 0) {
							const result = await workerPool.parse(
								requestId,
								data,
								extent,
								typeof projection === 'string' ? projection : projection.getCode()
							);

							if (result.success && result.features) {
								const features = reconstructFeatures(
									/** @type {import('./featureReconstructor.js').SerializedFeature[]} */ (result.features)
								);
								vectorTile.setFeatures(
									/** @type {import('ol/render/Feature').default[]} */ (/** @type {unknown} */ (features))
								);
							} else if (result.error !== 'Cancelled') {
								// Fallback to main thread parsing on worker error
								fallbackParse(vectorTile, data, extent, projection);
							}
						} else {
							// No workers available, parse on main thread
							fallbackParse(vectorTile, data, extent, projection);
						}
					})
					.catch((error) => {
						if (error.name === 'AbortError') {
							// Request was cancelled, don't treat as error
							vectorTile.setState(4); // EMPTY
							return;
						}
						console.error(`Error loading ${layerType} vector tile:`, error);
						vectorTile.setState(3); // ERROR
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
			}
		);
	};
	return loadFunction;
}

/**
 * Fallback to main thread parsing when workers unavailable
 * @param {import('ol/VectorTile').default<import('ol/render/Feature').default>} tile
 * @param {ArrayBuffer} data
 * @param {import('ol/extent').Extent} extent
 * @param {import('ol/proj/Projection').default|string} projection
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
 * Creates a vector tile source for trenches
 * @param {string} selectedProject - The selected project ID
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {boolean} isGlobalView - Whether global view is active
 * @returns {import('ol/source/VectorTile').default<import('ol/render/Feature').default>}
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
 * Creates a vector tile source for addresses
 * @param {string} selectedProject - The selected project ID
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {boolean} isGlobalView - Whether global view is active
 * @returns {import('ol/source/VectorTile').default<import('ol/render/Feature').default>}
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
 * Creates a vector tile source for nodes
 * @param {string} selectedProject - The selected project ID
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {boolean} isGlobalView - Whether global view is active
 * @returns {import('ol/source/VectorTile').default<import('ol/render/Feature').default>}
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
 * Creates a vector tile source for areas
 * @param {string} selectedProject - The selected project ID
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {boolean} isGlobalView - Whether global view is active
 * @returns {import('ol/source/VectorTile').default<import('ol/render/Feature').default>}
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
