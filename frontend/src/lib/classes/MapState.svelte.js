import {
	createAddressLayer,
	createNodeLayer,
	createSelectionLayer,
	createTrenchLayer
} from '$lib/map';
import {
	createAddressTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from '$lib/map/tileSources';
import { m } from '$lib/paraglide/messages';
import { globalToaster } from '$lib/stores/toaster';

/**
 * Main state manager for the map
 * Manages layers, tile sources, and map instance
 */
export class MapState {
	// OpenLayers objects
	olMap = $state(null);
	vectorTileLayer = $state(null);
	addressLayer = $state(null);
	nodeLayer = $state(null);
	selectionLayer = $state(null);
	addressSelectionLayer = $state(null);
	nodeSelectionLayer = $state(null);

	// Tile sources
	tileSource = $state(null);
	addressTileSource = $state(null);
	nodeTileSource = $state(null);

	// Configuration
	selectedProject = $state(null);
	trenchColor = $state(null);
	trenchColorSelected = $state(null);

	// Add layer configuration
	layerConfig = $state({
		trench: true,
		address: true,
		node: true
	});

	/**
	 * @param {string} selectedProject - Current project ID
	 * @param {string} trenchColor - Color for trench rendering
	 * @param {string} trenchColorSelected - Color for selected trenches
	 * @param {Object} layerConfig - Configuration for which layers to load (optional)
	 */
	constructor(selectedProject, trenchColor, trenchColorSelected, layerConfig = null) {
		this.selectedProject = selectedProject;
		this.trenchColor = trenchColor;
		this.trenchColorSelected = trenchColorSelected;

		if (layerConfig) {
			this.layerConfig = { ...this.layerConfig, ...layerConfig };
		}
	}

	/**
	 * Initialize layers and tile sources
	 * @returns {boolean} True if initialization succeeded
	 */
	initializeLayers() {
		try {
			// Create tile sources only for enabled layers
			if (this.layerConfig.trench) {
				this.tileSource = createTrenchTileSource(this.selectedProject, this.handleTileError);
				this.vectorTileLayer = createTrenchLayer(
					this.selectedProject,
					this.trenchColor,
					m.nav_trench(),
					this.handleTileError
				);
			}

			if (this.layerConfig.address) {
				this.addressTileSource = createAddressTileSource(
					this.selectedProject,
					this.handleTileError
				);
				this.addressLayer = createAddressLayer(
					this.selectedProject,
					m.form_address(),
					this.handleTileError
				);
			}

			if (this.layerConfig.node) {
				this.nodeTileSource = createNodeTileSource(this.selectedProject, this.handleTileError);
				this.nodeLayer = createNodeLayer(this.selectedProject, m.form_node(), this.handleTileError);
			}

			return true;
		} catch (error) {
			globalToaster.error({
				title: m.title_error_initializing_map_tiles(),
				description: error.message || 'Could not set up the tile layer.'
			});

			// Reset everything on error
			this.vectorTileLayer = null;
			this.tileSource = null;
			this.addressLayer = null;
			this.addressTileSource = null;
			this.nodeLayer = null;
			this.nodeTileSource = null;

			return false;
		}
	}

	/**
	 * Initialize selection layers after map is ready
	 * @param {Object} olMap - OpenLayers map instance
	 * @param {Function} getSelectionStore - Function to get current selection store
	 */
	initializeSelectionLayers(olMap, getSelectionStore) {
		if (!olMap || !this.tileSource) return;

		this.olMap = olMap;

		// Create selection layers
		this.selectionLayer = createSelectionLayer(
			this.tileSource,
			this.trenchColorSelected,
			getSelectionStore
		);
		this.olMap.addLayer(this.selectionLayer);

		this.addressSelectionLayer = createSelectionLayer(
			this.addressTileSource,
			this.trenchColorSelected,
			getSelectionStore
		);
		this.olMap.addLayer(this.addressSelectionLayer);

		this.nodeSelectionLayer = createSelectionLayer(
			this.nodeTileSource,
			this.trenchColorSelected,
			getSelectionStore
		);
		this.olMap.addLayer(this.nodeSelectionLayer);
	}

	/**
	 * Refresh all tile sources
	 */
	refreshTileSources() {
		if (this.tileSource && this.layerConfig.trench) {
			this.tileSource.refresh();
		}
		if (this.addressTileSource && this.layerConfig.address) {
			this.addressTileSource.refresh();
		}
		if (this.nodeTileSource && this.layerConfig.node) {
			this.nodeTileSource.refresh();
		}
	}

	/**
	 * Get all layers as an array for passing to Map component
	 * @returns {Array} Array of OpenLayers layers
	 */
	getLayers() {
		const layers = [];

		if (this.vectorTileLayer) layers.push(this.vectorTileLayer);
		if (this.addressLayer) layers.push(this.addressLayer);
		if (this.nodeLayer) layers.push(this.nodeLayer);

		return layers;
	}

	/**
	 * Get all selection layers for registration with SelectionManager
	 * @returns {Array} Array of selection layers
	 */
	getSelectionLayers() {
		return [this.selectionLayer, this.addressSelectionLayer, this.nodeSelectionLayer].filter(
			Boolean
		);
	}

	/**
	 * Get layer references for interaction manager
	 * @returns {Object} Object with layer references
	 */
	getLayerReferences() {
		return {
			vectorTileLayer: this.vectorTileLayer,
			addressLayer: this.addressLayer,
			nodeLayer: this.nodeLayer
		};
	}

	/**
	 * Error handler for tile loading
	 * @param {string} message - Error title
	 * @param {string} description - Error description
	 */
	handleTileError = (message, description) => {
		globalToaster.error({
			title: message,
			description: description
		});
	};

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		if (!this.olMap) return;

		// Remove selection layers
		if (this.selectionLayer) {
			this.olMap.removeLayer(this.selectionLayer);
		}
		if (this.addressSelectionLayer) {
			this.olMap.removeLayer(this.addressSelectionLayer);
		}
		if (this.nodeSelectionLayer) {
			this.olMap.removeLayer(this.nodeSelectionLayer);
		}

		// Dispose of tile sources
		if (this.vectorTileLayer && this.vectorTileLayer.getSource()) {
			this.vectorTileLayer.getSource().dispose();
		}
		if (this.addressLayer && this.addressLayer.getSource()) {
			this.addressLayer.getSource().dispose();
		}
		if (this.nodeLayer && this.nodeLayer.getSource()) {
			this.nodeLayer.getSource().dispose();
		}

		// Reset state
		this.olMap = null;
		this.vectorTileLayer = null;
		this.addressLayer = null;
		this.nodeLayer = null;
		this.selectionLayer = null;
		this.addressSelectionLayer = null;
		this.nodeSelectionLayer = null;
		this.tileSource = null;
		this.addressTileSource = null;
		this.nodeTileSource = null;
	}
}
