/**
 * Manages user interactions with the map
 * Handles click events, feature selection, and coordinates with other managers
 */
export class MapInteractionManager {
	olMap = $state(null);
	layers = $state({});
	selectionManager = $state(null);
	popupManager = $state(null);
	searchPanelRef = $state(null);

	/**
	 * @param {Object} selectionManager - MapSelectionManager instance
	 * @param {Object} popupManager - MapPopupManager instance
	 */
	constructor(selectionManager, popupManager) {
		this.selectionManager = selectionManager;
		this.popupManager = popupManager;
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
			this.handleFeatureClick(clickedFeatures[0], event.coordinate);
		} else {
			this.handleEmptyClick();
		}
	}

	/**
	 * Get features at a given pixel
	 * @param {Array} pixel - [x, y] pixel coordinates
	 * @returns {Array} Array of features at that pixel
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
				clickedFeatures.push(feature);
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
	 */
	handleFeatureClick(feature, coordinate) {
		const featureId = feature.getId();

		if (featureId) {
			// Update selection
			this.selectionManager.selectFeature(featureId, feature);

			// Show popup
			this.popupManager.show(coordinate, feature);
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
