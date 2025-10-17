import {
	detectFeatureType,
	formatFeatureProperties,
	getFeatureTitle
} from '$lib/utils/featureUtils';

/**
 * Manages user interactions with the map
 * Handles click events, feature selection, and coordinates with other managers
 */
export class MapInteractionManager {
	olMap = $state(null);
	layers = $state({});
	selectionManager = $state(null);
	popupManager = $state(null);
	drawerStore = $state(null);
	drawerComponent = $state(null);
	alias = $state({});
	searchPanelRef = $state(null);

	/**
	 * @param {Object} selectionManager - MapSelectionManager instance
	 * @param {Object} popupManager - MapPopupManager instance
	 * @param {Object} drawerStore - Drawer store instance
	 * @param {Object} drawerComponent - MapDrawerTabs component
	 * @param {Object} alias - Field name alias mapping (English -> Localized)
	 */
	constructor(selectionManager, popupManager, drawerStore, drawerComponent, alias = {}) {
		this.selectionManager = selectionManager;
		this.popupManager = popupManager;
		this.drawerStore = drawerStore;
		this.drawerComponent = drawerComponent;
		this.alias = alias;
	}

	/**
	 * Initialize interaction handlers on the map
	 * @param {Object} olMap - OpenLayers map instance
	 * @param {Object} layers - Object containing layer references
	 * @param {Object} searchPanelRef - Reference to search panel component
	 */
	initialize(olMap, layers, searchPanelRef = null) {
		if (!olMap) {
			console.error('Map instance is required');
			return false;
		}

		this.olMap = olMap;
		this.layers = layers;
		this.searchPanelRef = searchPanelRef;

		// Register click handler
		this.olMap.on('click', (event) => this.handleMapClick(event));

		return true;
	}

	/**
	 * Handle map click events
	 * @param {Object} event - OpenLayers map click event
	 */
	handleMapClick(event) {
		if (!this.olMap) return;

		// Clear search panel highlight if present
		this.clearSearchHighlight();

		// Detect features at click pixel
		const clickedFeatures = this.getClickedFeatures(event.pixel);

		if (clickedFeatures.length > 0) {
			const { feature, layer } = clickedFeatures[0];
			this.handleFeatureClick(feature, event.coordinate, layer);
		} else {
			this.handleEmptyClick();
		}
	}

	/**
	 * Get features at a given pixel
	 * @param {Array} pixel - [x, y] pixel coordinates
	 * @returns {Array} Array of {feature, layer} objects at that pixel
	 */
	getClickedFeatures(pixel) {
		const clickedFeatures = [];
		const { vectorTileLayer, addressLayer, nodeLayer } = this.layers;

		// Only check configured layers
		const layersToCheck = [vectorTileLayer, addressLayer, nodeLayer].filter(Boolean);

		if (layersToCheck.length === 0) return clickedFeatures;

		this.olMap.forEachFeatureAtPixel(
			pixel,
			(feature, layer) => {
				clickedFeatures.push({ feature, layer });
			},
			{
				hitTolerance: 10,
				layerFilter: (layer) => layersToCheck.includes(layer)
			}
		);

		return clickedFeatures;
	}

	/**
	 * Handle click on a feature
	 * @param {Object} feature - OpenLayers feature
	 * @param {Array} coordinate - Map coordinates [x, y]
	 * @param {Object} layer - OpenLayers layer (optional)
	 */
	handleFeatureClick(feature, coordinate, layer = null) {
		const featureId = feature.getId();

		if (featureId) {
			// Update selection
			this.selectionManager.selectFeature(featureId, feature);

			// Detect feature type (pass layer for better detection)
			const featureType = detectFeatureType(feature, layer);

			if (featureType && this.drawerStore && this.drawerComponent) {
				// Get properties from MVT
				const rawProperties = feature.getProperties();
				const properties = formatFeatureProperties(rawProperties, featureType);

				// Get display title
				const title = getFeatureTitle(feature, featureType);

				// Open drawer with feature details
				this.drawerStore.open({
					title,
					component: this.drawerComponent,
					props: {
						featureData: properties,
						featureType,
						featureId,
						alias: this.alias
					}
				});
			} else {
				// Fallback to popup if drawer not configured
				this.popupManager.show(coordinate, feature);
			}
		} else {
			this.handleEmptyClick();
		}
	}

	/**
	 * Handle click on empty area
	 */
	handleEmptyClick() {
		this.selectionManager.clearSelection();
		this.popupManager.hide();

		// Close drawer if open
		if (this.drawerStore) {
			this.drawerStore.close();
		}
	}

	/**
	 * Clear highlight from search panel
	 */
	clearSearchHighlight() {
		if (!this.searchPanelRef) return;

		// Try to access search panel's highlight layer
		if (this.searchPanelRef.getHighlightLayer) {
			const highlightLayer = this.searchPanelRef.getHighlightLayer();
			if (highlightLayer && highlightLayer.getSource()) {
				highlightLayer.getSource().clear();
			}
		}
	}

	/**
	 * Update search panel reference
	 * @param {Object} ref - Search panel component reference
	 */
	setSearchPanelRef(ref) {
		this.searchPanelRef = ref;
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		// OpenLayers automatically removes event listeners when map is disposed
		this.olMap = null;
		this.layers = {};
		this.searchPanelRef = null;
	}
}
