import { m } from '$lib/paraglide/messages';

import {
	createAddressStyleWithLabels,
	createAreaStyleByType,
	createNodeStyleByType,
	createTrenchStyle,
	createTrenchStyleByAttribute
} from '$lib/map/styles';
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from '$lib/map/tileSources';
import { globalToaster } from '$lib/stores/toaster';
import {
	createAddressLayer,
	createAreaLayer,
	createNodeLayer,
	createSelectionLayer,
	createTrenchLayer
} from '$lib/map';

// Default style values (match store defaults)
const DEFAULT_TRENCH_COLOR = '#000000';
const DEFAULT_SELECTED_COLOR = '#000000';
const DEFAULT_ADDRESS_COLOR = '#2563eb';
const DEFAULT_ADDRESS_SIZE = 4;

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
	areaLayer = $state(null);
	selectionLayer = $state(null);
	addressSelectionLayer = $state(null);
	nodeSelectionLayer = $state(null);
	areaSelectionLayer = $state(null);

	// Tile sources
	tileSource = $state(null);
	addressTileSource = $state(null);
	nodeTileSource = $state(null);
	areaTileSource = $state(null);

	// Configuration
	selectedProject = $state(null);
	selectedColor = $state(DEFAULT_SELECTED_COLOR);
	addressColor = $state(DEFAULT_ADDRESS_COLOR);
	addressSize = $state(DEFAULT_ADDRESS_SIZE);

	// Add layer configuration
	layerConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});

	// Label configuration
	labelConfig = $state({
		trench: { enabled: false, field: 'id_trench', minResolution: 1.5 },
		conduit: { enabled: false, field: 'conduit_names', minResolution: 1.5 },
		address: { enabled: false, field: 'street', minResolution: 1.0 },
		node: { enabled: false, field: 'name', minResolution: 1.0 },
		area: { enabled: false, field: 'name', minResolution: 5.0 }
	});

	/**
	 * @param {string} selectedProject - Current project ID
	 * @param {string} selectedColor - Color for selected features (optional, for selection layers)
	 * @param {Object} layerConfig - Configuration for which layers to load (optional)
	 * @param {Object} labelConfig - Configuration for text labels on layers (optional)
	 */
	constructor(
		selectedProject,
		selectedColor = DEFAULT_SELECTED_COLOR,
		layerConfig = null,
		labelConfig = null
	) {
		this.selectedProject = selectedProject;
		this.selectedColor = selectedColor;

		if (layerConfig) {
			this.layerConfig = { ...this.layerConfig, ...layerConfig };
		}

		if (labelConfig) {
			this.labelConfig = { ...this.labelConfig, ...labelConfig };
		}
	}

	/**
	 * Initialize layers and tile sources
	 * @returns {boolean} True if initialization succeeded
	 */
	initializeLayers() {
		try {
			if (this.layerConfig.trench) {
				this.tileSource = createTrenchTileSource(this.selectedProject, this.handleTileError);
				this.vectorTileLayer = createTrenchLayer(
					this.selectedProject,
					m.nav_trench(),
					this.handleTileError,
					this.labelConfig.trench
				);
			}

			if (this.layerConfig.address) {
				this.addressTileSource = createAddressTileSource(
					this.selectedProject,
					this.handleTileError
				);
				this.addressLayer = createAddressLayer(
					this.selectedProject,
					m.form_address({ count: 1 }),
					this.handleTileError,
					this.labelConfig.address
				);
			}

			if (this.layerConfig.node) {
				this.nodeTileSource = createNodeTileSource(this.selectedProject, this.handleTileError);
				this.nodeLayer = createNodeLayer(
					this.selectedProject,
					m.form_node(),
					this.handleTileError,
					this.labelConfig.node
				);
			}

			if (this.layerConfig.area) {
				this.areaTileSource = createAreaTileSource(this.selectedProject, this.handleTileError);
				this.areaLayer = createAreaLayer(
					this.selectedProject,
					m.form_area(),
					this.handleTileError,
					this.labelConfig.area
				);
			}

			return true;
		} catch (error) {
			globalToaster.error({
				title: m.title_error_initializing_map_tiles(),
				description: error.message || 'Could not set up the tile layer.'
			});

			this.vectorTileLayer = null;
			this.tileSource = null;
			this.addressLayer = null;
			this.addressTileSource = null;
			this.nodeLayer = null;
			this.nodeTileSource = null;
			this.areaLayer = null;
			this.areaTileSource = null;

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

		this.selectionLayer = createSelectionLayer(
			this.tileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.selectionLayer);

		this.addressSelectionLayer = createSelectionLayer(
			this.addressTileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.addressSelectionLayer);

		this.nodeSelectionLayer = createSelectionLayer(
			this.nodeTileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.nodeSelectionLayer);

		if (this.areaTileSource) {
			this.areaSelectionLayer = createSelectionLayer(
				this.areaTileSource,
				this.selectedColor,
				getSelectionStore
			);
			this.olMap.addLayer(this.areaSelectionLayer);
		}
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
		if (this.areaTileSource && this.layerConfig.area) {
			this.areaTileSource.refresh();
		}
	}

	/**
	 * Reinitialize tile sources for a new project
	 * Clears cached tiles and creates new sources with the new project ID
	 * @param {string} newProjectId - The new project ID
	 */
	reinitializeForProject(newProjectId) {
		if (this.selectedProject === newProjectId) return;

		this.selectedProject = newProjectId;

		if (this.vectorTileLayer && this.layerConfig.trench) {
			const oldSource = this.vectorTileLayer.getSource();
			if (oldSource) {
				oldSource.clear();
			}
			this.tileSource = createTrenchTileSource(newProjectId, this.handleTileError);
			this.vectorTileLayer.setSource(this.tileSource);

			if (this.selectionLayer) {
				this.selectionLayer.setSource(this.tileSource);
			}
		}

		if (this.addressLayer && this.layerConfig.address) {
			const oldSource = this.addressLayer.getSource();
			if (oldSource) {
				oldSource.clear();
			}
			this.addressTileSource = createAddressTileSource(newProjectId, this.handleTileError);
			this.addressLayer.setSource(this.addressTileSource);

			if (this.addressSelectionLayer) {
				this.addressSelectionLayer.setSource(this.addressTileSource);
			}
		}

		if (this.nodeLayer && this.layerConfig.node) {
			const oldSource = this.nodeLayer.getSource();
			if (oldSource) {
				oldSource.clear();
			}
			this.nodeTileSource = createNodeTileSource(newProjectId, this.handleTileError);
			this.nodeLayer.setSource(this.nodeTileSource);

			if (this.nodeSelectionLayer) {
				this.nodeSelectionLayer.setSource(this.nodeTileSource);
			}
		}

		if (this.areaLayer && this.layerConfig.area) {
			const oldSource = this.areaLayer.getSource();
			if (oldSource) {
				oldSource.clear();
			}
			this.areaTileSource = createAreaTileSource(newProjectId, this.handleTileError);
			this.areaLayer.setSource(this.areaTileSource);

			if (this.areaSelectionLayer) {
				this.areaSelectionLayer.setSource(this.areaTileSource);
			}
		}
	}

	/**
	 * Get all layers as an array for passing to Map component
	 * Area layer is added first so it renders below other layers
	 * @returns {Array} Array of OpenLayers layers
	 */
	getLayers() {
		const layers = [];

		if (this.areaLayer) layers.push(this.areaLayer);
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
		return [
			this.selectionLayer,
			this.addressSelectionLayer,
			this.nodeSelectionLayer,
			this.areaSelectionLayer
		].filter(Boolean);
	}

	/**
	 * Get layer references for interaction manager
	 * @returns {Object} Object with layer references
	 */
	getLayerReferences() {
		return {
			vectorTileLayer: this.vectorTileLayer,
			addressLayer: this.addressLayer,
			nodeLayer: this.nodeLayer,
			areaLayer: this.areaLayer
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
	 * Update the node layer style based on node type styles
	 * @param {Object} nodeTypeStyles - Object mapping node type names to style config
	 */
	updateNodeLayerStyle(nodeTypeStyles) {
		if (!this.nodeLayer) return;

		const newStyle = createNodeStyleByType(nodeTypeStyles, this.labelConfig.node);
		this.nodeLayer.setStyle(newStyle);

		if (this.nodeTileSource) {
			this.nodeTileSource.refresh();
		}
	}

	/**
	 * Update the trench layer style based on style mode and attribute styles
	 * @param {string} styleMode - 'none' | 'surface' | 'construction_type'
	 * @param {Object} surfaceStyles - Object mapping surface names to style config
	 * @param {Object} constructionTypeStyles - Object mapping construction type names to style config
	 * @param {string} fallbackColor - Color to use when styleMode is 'none'
	 */
	updateTrenchLayerStyle(styleMode, surfaceStyles, constructionTypeStyles, fallbackColor) {
		if (!this.vectorTileLayer) return;

		let newStyle;
		if (styleMode === 'none') {
			newStyle = createTrenchStyle(
				fallbackColor,
				this.labelConfig.trench,
				this.labelConfig.conduit
			);
		} else {
			const attributeStyles = styleMode === 'surface' ? surfaceStyles : constructionTypeStyles;
			newStyle = createTrenchStyleByAttribute(
				attributeStyles,
				styleMode,
				fallbackColor,
				this.labelConfig.trench,
				this.labelConfig.conduit
			);
		}

		this.vectorTileLayer.setStyle(newStyle);

		if (this.tileSource) {
			this.tileSource.refresh();
		}
	}

	/**
	 * Update the address layer style with current label config and style settings
	 * @param {string} [color] - Optional color to update
	 * @param {number} [size] - Optional size to update
	 */
	updateAddressLayerStyle(color = null, size = null) {
		if (!this.addressLayer) return;

		if (color !== null) {
			this.addressColor = color;
		}
		if (size !== null) {
			this.addressSize = size;
		}

		const newStyle = createAddressStyleWithLabels(
			this.addressColor,
			this.addressSize,
			this.labelConfig.address
		);
		this.addressLayer.setStyle(newStyle);

		if (this.addressTileSource) {
			this.addressTileSource.refresh();
		}
	}

	/**
	 * Update the area layer style based on area type styles
	 * @param {Object} areaTypeStyles - Object mapping area type names to style config
	 */
	updateAreaLayerStyle(areaTypeStyles) {
		if (!this.areaLayer) return;

		const newStyle = createAreaStyleByType(areaTypeStyles, this.labelConfig.area);
		this.areaLayer.setStyle(newStyle);

		if (this.areaTileSource) {
			this.areaTileSource.refresh();
		}
	}

	/**
	 * Update label visibility for a specific layer type
	 * @param {string} layerType - 'trench' | 'address' | 'node' | 'area' | 'conduit'
	 * @param {boolean} enabled - Whether labels should be shown
	 * @param {Object} currentStyles - Current style settings (for trench/conduit: { mode, surfaceStyles, constructionTypeStyles, color }, for node: nodeTypeStyles, for area: areaTypeStyles)
	 */
	updateLabelVisibility(layerType, enabled, currentStyles = {}) {
		const currentLabelConfig = this.labelConfig[layerType];
		if (currentLabelConfig.enabled === enabled) {
			return;
		}
		currentLabelConfig.enabled = enabled;

		switch (layerType) {
			case 'trench':
			case 'conduit':
				if (currentStyles.mode !== undefined) {
					this.updateTrenchLayerStyle(
						currentStyles.mode,
						currentStyles.surfaceStyles || {},
						currentStyles.constructionTypeStyles || {},
						currentStyles.color || this.trenchColor
					);
				}
				break;
			case 'address':
				this.updateAddressLayerStyle();
				break;
			case 'node':
				if (currentStyles.nodeTypeStyles) {
					this.updateNodeLayerStyle(currentStyles.nodeTypeStyles);
				}
				break;
			case 'area':
				if (currentStyles.areaTypeStyles) {
					this.updateAreaLayerStyle(currentStyles.areaTypeStyles);
				}
				break;
		}
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		if (!this.olMap) return;

		if (this.selectionLayer) {
			this.olMap.removeLayer(this.selectionLayer);
		}
		if (this.addressSelectionLayer) {
			this.olMap.removeLayer(this.addressSelectionLayer);
		}
		if (this.nodeSelectionLayer) {
			this.olMap.removeLayer(this.nodeSelectionLayer);
		}
		if (this.areaSelectionLayer) {
			this.olMap.removeLayer(this.areaSelectionLayer);
		}

		if (this.vectorTileLayer && this.vectorTileLayer.getSource()) {
			this.vectorTileLayer.getSource().dispose();
		}
		if (this.addressLayer && this.addressLayer.getSource()) {
			this.addressLayer.getSource().dispose();
		}
		if (this.nodeLayer && this.nodeLayer.getSource()) {
			this.nodeLayer.getSource().dispose();
		}
		if (this.areaLayer && this.areaLayer.getSource()) {
			this.areaLayer.getSource().dispose();
		}

		this.olMap = null;
		this.vectorTileLayer = null;
		this.addressLayer = null;
		this.nodeLayer = null;
		this.areaLayer = null;
		this.selectionLayer = null;
		this.addressSelectionLayer = null;
		this.nodeSelectionLayer = null;
		this.areaSelectionLayer = null;
		this.tileSource = null;
		this.addressTileSource = null;
		this.nodeTileSource = null;
		this.areaTileSource = null;
	}
}
