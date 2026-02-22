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
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from './tileSources.js';

// Default style values (match store defaults)
const DEFAULT_TRENCH_COLOR = '#000000';
const DEFAULT_ADDRESS_COLOR = '#2563eb';
const DEFAULT_ADDRESS_SIZE = 4;

/**
 * Creates a vector tile layer for trenches
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {Function} onError - Error callback function
 * @param {Object} labelOptions - Optional label configuration
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
 * Creates a vector tile layer for addresses
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {Function} onError - Error callback function
 * @param {Object} labelOptions - Optional label configuration
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
 * Creates a vector tile layer for nodes
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {Function} onError - Error callback function
 * @param {Object} labelOptions - Optional label configuration
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @param {Object} [nodeTypeStyles={}] - Optional per-type style configuration
 * @returns {VectorTileLayer}
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
 * Creates a vector tile layer for areas (polygons)
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {string} layerName - Display name for the layer
 * @param {Function} onError - Error callback function
 * @param {Object} labelOptions - Optional label configuration
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=5.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @param {Object} [areaTypeStyles=null] - Optional per-type style configuration
 * @returns {VectorTileLayer}
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
 * Creates a selection layer for any vector tile source
 * @param {VectorTileSource} tileSource - The tile source to use
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
 * Creates a TileWMS layer for a WMS source layer.
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
		crossOrigin: 'anonymous'
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
