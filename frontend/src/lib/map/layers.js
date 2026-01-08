// OpenLayers
import VectorTileLayer from 'ol/layer/VectorTile.js';

import {
	createAddressStyle,
	createAddressStyleWithLabels,
	createNodeStyle,
	createNodeStyleByType,
	createNodeStyleWithLabels,
	createSelectedStyle,
	createTrenchStyle,
	createTrenchStyleWithLabels
} from './styles.js';
import {
	createAddressTileSource,
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

	// Use style function with labels if enabled, otherwise use static style
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

	// Use style function with labels if enabled, otherwise use static style
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
		}
	});
}
