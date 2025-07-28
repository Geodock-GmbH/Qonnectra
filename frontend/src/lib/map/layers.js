// OpenLayers
import VectorTileLayer from 'ol/layer/VectorTile.js';

// Local imports
import { createTrenchTileSource, createAddressTileSource, createNodeTileSource } from './tileSources.js';
import { createTrenchStyle, createAddressStyle, createNodeStyle, createSelectedStyle } from './styles.js';

/**
 * Creates a vector tile layer for trenches
 * @param {import('svelte/store').Readable<string>} selectedProject - Store containing the selected project ID
 * @param {string} trenchColor - Color for trench features
 * @param {string} layerName - Display name for the layer
 * @param {Function} onError - Error callback function
 * @returns {VectorTileLayer}
 */
export function createTrenchLayer(selectedProject, trenchColor, layerName, onError) {
	const tileSource = createTrenchTileSource(selectedProject, onError);
	const style = createTrenchStyle(trenchColor);
	
	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
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
 * @returns {VectorTileLayer}
 */
export function createAddressLayer(selectedProject, layerName, onError) {
	const tileSource = createAddressTileSource(selectedProject, onError);
	const style = createAddressStyle();
	
	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
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
 * @returns {VectorTileLayer}
 */
export function createNodeLayer(selectedProject, layerName, onError) {
	const tileSource = createNodeTileSource(selectedProject, onError);
	const style = createNodeStyle();
	
	return new VectorTileLayer({
		source: tileSource,
		style: style,
		renderMode: 'vector',
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