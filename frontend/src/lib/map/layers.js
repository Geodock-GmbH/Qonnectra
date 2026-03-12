import TileLayer from 'ol/layer/Tile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import TileWMS from 'ol/source/TileWMS.js';

import {
	createAddressStyleWithLabels,
	createAreaStyleByType,
	createAreaStyleWithLabels,
	createNodeStyle,
	createNodeStyleByType,
	createNodeStyleWithLabels,
	createSelectedStyle,
	createTrenchStyle,
	createTrenchStyleWithLabels,
	DEFAULT_AREA_COLOR
} from './styles.js';
import { tileLoadingManager } from './tileLoadingManager.js';
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from './tileSources.js';

const DEFAULT_TRENCH_COLOR = '#000000';
const DEFAULT_ADDRESS_COLOR = '#2563eb';
const DEFAULT_ADDRESS_SIZE = 4;

/**
 * Creates a vector tile layer for trenches
 * @param {string} selectedProject - The selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {Object} [labelOptions] - Optional label configuration
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='id_trench'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.5] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {VectorTileLayer}
 */
export function createTrenchLayer(selectedProject, layerName, onError, labelOptions = {}) {
	const tileSource = createTrenchTileSource(selectedProject, onError);

	const style = labelOptions.enabled
		? createTrenchStyleWithLabels(DEFAULT_TRENCH_COLOR, labelOptions)
		: createTrenchStyle(DEFAULT_TRENCH_COLOR);

	return new VectorTileLayer({
		source: tileSource,
		style: /** @type {import('ol/style/Style').StyleLike} */ (style),
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'trench-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a vector tile layer for addresses
 * @param {string} selectedProject - The selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {Object} [labelOptions] - Optional label configuration
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {VectorTileLayer}
 */
export function createAddressLayer(selectedProject, layerName, onError, labelOptions = {}) {
	const tileSource = createAddressTileSource(selectedProject, onError);

	const style = createAddressStyleWithLabels(
		DEFAULT_ADDRESS_COLOR,
		DEFAULT_ADDRESS_SIZE,
		labelOptions
	);

	return new VectorTileLayer({
		source: tileSource,
		style: /** @type {import('ol/style/Style').StyleLike} */ (style),
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'address-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a vector tile layer for nodes
 * @param {string} selectedProject - The selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {Object} [labelOptions] - Optional label configuration
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @param {Record<string, {color?: string, size?: number, visible?: boolean}> | undefined} [nodeTypeStyles] - Optional per-type style configuration
 * @returns {VectorTileLayer}
 */
export function createNodeLayer(
	selectedProject,
	layerName,
	onError,
	labelOptions = {},
	nodeTypeStyles = undefined
) {
	const tileSource = createNodeTileSource(selectedProject, onError);

	let style;
	if (nodeTypeStyles !== undefined) {
		style = createNodeStyleByType(/** @type {Record<string, {color?: string, size?: number, visible?: boolean}>} */ (nodeTypeStyles), labelOptions);
	} else if (labelOptions.enabled) {
		style = createNodeStyleWithLabels(labelOptions);
	} else {
		style = createNodeStyle();
	}

	return new VectorTileLayer({
		source: tileSource,
		style: /** @type {import('ol/style/Style').StyleLike} */ (style),
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'node-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a vector tile layer for areas (polygons)
 * @param {string} selectedProject - The selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {(title: string, message: string) => void} onError - Error callback function
 * @param {Object} [labelOptions] - Optional label configuration
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=5.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @param {Record<string, {color?: string, visible?: boolean}> | undefined} [areaTypeStyles] - Optional per-type style configuration
 * @returns {VectorTileLayer}
 */
export function createAreaLayer(
	selectedProject,
	layerName,
	onError,
	labelOptions = {},
	areaTypeStyles = undefined
) {
	const tileSource = createAreaTileSource(selectedProject, onError);

	let style;
	if (areaTypeStyles !== undefined) {
		style = createAreaStyleByType(/** @type {Record<string, {color?: string, visible?: boolean}>} */ (areaTypeStyles), labelOptions);
	} else {
		style = createAreaStyleWithLabels(DEFAULT_AREA_COLOR, 0.3, labelOptions);
	}

	return new VectorTileLayer({
		source: tileSource,
		style: /** @type {import('ol/style/Style').StyleLike} */ (style),
		renderMode: 'vector',
		declutter: labelOptions.enabled,
		properties: {
			layerId: 'area-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a selection layer for any vector tile source
 * @param {import('ol/source/VectorTile').default} tileSource - The tile source to use
 * @param {string} selectedColor - Color for selected features
 * @param {Function} getSelectionStore - Function that returns the current selection store
 * @returns {VectorTileLayer}
 */
export function createSelectionLayer(tileSource, selectedColor, getSelectionStore) {
	const selectedStyle = createSelectedStyle(selectedColor);

	return new VectorTileLayer({
		renderMode: 'vector',
		source: tileSource,
		style: function (feature) {
			const selectionStore = getSelectionStore();
			const featureId = feature.getId();
			if (featureId !== undefined && selectionStore[featureId]) {
				return selectedStyle;
			}
			return undefined;
		},
		properties: {
			isSelectionLayer: true
		}
	});
}

/**
 * Creates a TileWMS layer for a WMS source layer with AbortController support.
 * @param {Object} options - Layer options
 * @param {string} options.proxyUrl - WMS proxy URL
 * @param {string} options.layerName - WMS layer name
 * @param {string} options.layerId - Unique layer ID for the map
 * @param {string} options.displayName - Display name for the layer tree
 * @param {string} options.sourceId - WMS source UUID
 * @param {string} options.sourceName - WMS source display name
 * @param {number} [options.minZoom=8] - Minimum zoom level
 * @param {number} [options.maxZoom] - Maximum zoom level (undefined = no limit)
 * @param {number} [options.opacity=1.0] - Layer opacity (0.0 to 1.0)
 * @returns {TileLayer}
 */
export function createWMSLayer({
	proxyUrl,
	layerName,
	layerId,
	displayName,
	sourceId,
	sourceName,
	minZoom = 8,
	maxZoom = undefined,
	opacity = 1.0
}) {
	let requestCounter = 0;

	const source = new TileWMS({
		url: proxyUrl,
		params: {
			LAYERS: layerName,
			FORMAT: 'image/png',
			TRANSPARENT: true,
			VERSION: '1.3.0',
			CRS: 'EPSG:3857'
		},
		projection: 'EPSG:3857',
		crossOrigin: 'anonymous',
		tileLoadFunction: (tile, src) => {
			if (tileLoadingManager.isLoadingPaused()) {
				tile.setState(4);
				return;
			}

			const requestId = `wms-${layerId}-${Date.now()}-${requestCounter++}`;
			const controller = tileLoadingManager.createAbortController(requestId);
			const image = /** @type {HTMLImageElement} */ (
				/** @type {import('ol/ImageTile').default} */ (tile).getImage()
			);

			fetch(src, {
				signal: controller.signal,
				credentials: 'include'
			})
				.then((response) => {
					if (!response.ok) {
						throw new Error(`WMS request failed: ${response.statusText}`);
					}
					return response.blob();
				})
				.then((blob) => {
					const objectUrl = URL.createObjectURL(blob);
					image.src = objectUrl;
					image.onload = () => {
						URL.revokeObjectURL(objectUrl);
					};
				})
				.catch((error) => {
					if (error.name === 'AbortError') {
						tile.setState(4); // EMPTY
						return;
					}
					console.error(`WMS tile load error for ${layerId}:`, error);
					tile.setState(3); // ERROR
				})
				.finally(() => {
					tileLoadingManager.removeAbortController(requestId);
				});
		}
	});

	return new TileLayer({
		source: source,
		minZoom: minZoom,
		maxZoom: maxZoom,
		opacity: opacity,
		properties: {
			layerId: layerId,
			layerName: displayName,
			layerType: 'wms',
			wmsSourceId: sourceId,
			wmsSourceName: sourceName,
			wmsLayerName: layerName
		}
	});
}
