/**
 * Manages feature selection state for the map
 * Tracks which features are selected and provides methods to update selection
 */
export class MapSelectionManager {
	selectionStore = $state({});
	selectionLayers = $state([]);

	constructor() {}

	/**
	 * Select a feature by its ID
	 * @param {string} featureId - The ID of the feature to select
	 * @param {Object} feature - The feature object
	 */
	selectFeature(featureId, feature) {
		this.selectionStore = { [featureId]: feature };
		this.updateSelectionLayers();
	}

	/**
	 * Clear all selections
	 */
	clearSelection() {
		this.selectionStore = {};
		this.updateSelectionLayers();
	}

	/**
	 * Check if a feature is selected
	 * @param {string} featureId - The ID of the feature to check
	 * @returns {boolean} True if feature is selected
	 */
	isSelected(featureId) {
		return Boolean(this.selectionStore[featureId]);
	}

	/**
	 * Get currently selected feature
	 * @returns {Object|null} The selected feature or null
	 */
	getSelectedFeature() {
		const ids = Object.keys(this.selectionStore);
		return ids.length > 0 ? this.selectionStore[ids[0]] : null;
	}

	/**
	 * Register a selection layer
	 * @param {Object} layer - OpenLayers layer that displays selections
	 */
	registerSelectionLayer(layer) {
		if (layer && !this.selectionLayers.includes(layer)) {
			this.selectionLayers = [...this.selectionLayers, layer];
		}
	}

	/**
	 * Update all selection layers to reflect current selection state
	 */
	updateSelectionLayers() {
		this.selectionLayers.forEach((layer) => {
			if (layer && layer.changed) {
				layer.changed();
			}
		});
	}

	/**
	 * Get the selection store (for use in layer style functions)
	 * @returns {Object} The selection store
	 */
	getSelectionStore() {
		return this.selectionStore;
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		this.selectionStore = {};
		this.selectionLayers = [];
	}
}
