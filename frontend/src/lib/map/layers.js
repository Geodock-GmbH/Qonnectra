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

/**
 * @typedef {Object} LabelOptions
 * @property {boolean} [enabled=false] - Whether to show labels
 * @property {string} [field] - Feature property to use for label text
 * @property {number} [minResolution] - Minimum map resolution to display labels
 * @property {Object} [textStyle] - Custom OpenLayers text style options
 */

/**
 * @typedef {Record<string, { color: string; size?: number }>} NodeTypeStyles
 */

/**
 * @typedef {Record<string, { fillColor: string; strokeColor?: string }>} AreaTypeStyles
 */

/**
 * @typedef {(title: string, message: string) => void} LayerErrorCallback
 */

/**
 * @typedef {Object} WMSLayerOptions
 * @property {string} proxyUrl - WMS proxy URL endpoint
 * @property {string} layerName - WMS layer name for LAYERS parameter
 * @property {string} layerId - Unique layer ID for map identification
 * @property {string} displayName - Human-readable layer name
 * @property {string} sourceId - WMS source UUID
 * @property {string} sourceName - WMS source display name
 * @property {number} [minZoom=8] - Minimum zoom level for visibility
 * @property {number} [maxZoom] - Maximum zoom level (undefined = no limit)
 * @property {number} [opacity=1.0] - Layer opacity (0.0 to 1.0)
 */

/** @type {string} */
const DEFAULT_TRENCH_COLOR = '#000000';
/** @type {string} */
const DEFAULT_ADDRESS_COLOR = '#2563eb';
/** @type {number} */
const DEFAULT_ADDRESS_SIZE = 4;

/**
 * Creates a vector tile layer for trench features with optional labeling.
 * @param {string} selectedProject - Project ID to filter features by
 * @param {string} layerName - Display name for the layer tree
 * @param {LayerErrorCallback | undefined} onError - Optional callback for tile load errors
 * @param {LabelOptions} [labelOptions={}] - Label display configuration
 * @returns {VectorTileLayer} Configured vector tile layer for trenches
 */
export function createTrenchLayer(selectedProject, layerName, onError, labelOptions = {}) {
	const tileSource = createTrenchTileSource(selectedProject, onError);

	const style = labelOptions.enabled
		? createTrenchStyleWithLabels(DEFAULT_TRENCH_COLOR, labelOptions)
		: createTrenchStyle(DEFAULT_TRENCH_COLOR);

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled, // Enable decluttering when labels are shown
		properties: {
			layerId: 'trench-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a vector tile layer for address features with optional labeling.
 * @param {string} selectedProject - Project ID to filter features by
 * @param {string} layerName - Display name for the layer tree
 * @param {LayerErrorCallback | undefined} onError - Optional callback for tile load errors
 * @param {LabelOptions} [labelOptions={}] - Label display configuration
 * @returns {VectorTileLayer} Configured vector tile layer for addresses
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
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled, // Enable decluttering when labels are shown
		properties: {
			layerId: 'address-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a vector tile layer for node features with optional per-type styling and labels.
 * @param {string} selectedProject - Project ID to filter features by
 * @param {string} layerName - Display name for the layer tree
 * @param {LayerErrorCallback | undefined} onError - Optional callback for tile load errors
 * @param {LabelOptions} [labelOptions={}] - Label display configuration
 * @param {NodeTypeStyles | null} [nodeTypeStyles=null] - Per-type style mapping; when null uses default style
 * @returns {VectorTileLayer} Configured vector tile layer for nodes
 */
export function createNodeLayer(
	selectedProject,
	layerName,
	onError,
	labelOptions = {},
	nodeTypeStyles = null
) {
	const tileSource = createNodeTileSource(selectedProject, onError);

	let style;
	if (nodeTypeStyles !== null) {
		style = createNodeStyleByType(nodeTypeStyles, labelOptions);
	} else if (labelOptions.enabled) {
		style = createNodeStyleWithLabels(labelOptions);
	} else {
		style = createNodeStyle();
	}

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled, // Enable decluttering when labels are shown
		properties: {
			layerId: 'node-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a vector tile layer for area (polygon) features with optional per-type styling and labels.
 * @param {string} selectedProject - Project ID to filter features by
 * @param {string} layerName - Display name for the layer tree
 * @param {LayerErrorCallback | undefined} onError - Optional callback for tile load errors
 * @param {LabelOptions} [labelOptions={}] - Label display configuration
 * @param {AreaTypeStyles | null} [areaTypeStyles=null] - Per-type style mapping; when null uses default style
 * @returns {VectorTileLayer} Configured vector tile layer for areas
 */
export function createAreaLayer(
	selectedProject,
	layerName,
	onError,
	labelOptions = {},
	areaTypeStyles = null
) {
	const tileSource = createAreaTileSource(selectedProject, onError);

	let style;
	if (areaTypeStyles !== null) {
		style = createAreaStyleByType(areaTypeStyles, labelOptions);
	} else {
		style = createAreaStyleWithLabels(DEFAULT_AREA_COLOR, 0.3, labelOptions);
	}

	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
		declutter: labelOptions.enabled, // Enable decluttering when labels are shown
		properties: {
			layerId: 'area-layer',
			layerName: layerName
		}
	});
}

/**
 * Creates a selection overlay layer that highlights selected features.
 * @param {import('ol/source/VectorTile').default} tileSource - Vector tile source to overlay
 * @param {string} selectedColor - CSS color for selected feature highlighting
 * @param {() => Record<string, unknown>} getSelectionStore - Returns current selection state keyed by feature ID
 * @returns {VectorTileLayer} Selection overlay layer
 */
export function createSelectionLayer(tileSource, selectedColor, getSelectionStore) {
	const selectedStyle = createSelectedStyle(selectedColor);

	return new VectorTileLayer({
		renderMode: 'vector',
		source: tileSource,
		style: function (feature) {
			const selectionStore = getSelectionStore();
			if (feature.getId() && selectionStore[feature.getId()]) {
				return selectedStyle;
			}
			return undefined; // Don't render if not selected
		},
		properties: {
			isSelectionLayer: true
		}
	});
}

/**
 * Creates a TileWMS layer with AbortController support for request cancellation.
 * @param {WMSLayerOptions} options - WMS layer configuration
 * @returns {TileLayer<TileWMS>} Configured WMS tile layer
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
	/** @type {number} */
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
			// Skip loading if navigation is in progress
			if (tileLoadingManager.isLoadingPaused()) {
				tile.setState(4); // EMPTY
				return;
			}

			const requestId = `wms-${layerId}-${Date.now()}-${requestCounter++}`;
			const controller = tileLoadingManager.createAbortController(requestId);
			const image = tile.getImage();

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
