/**
 * @typedef {Record<string | number, import('ol/Feature').default | import('ol/render/Feature').default | true>} SelectionStore
 */

/**
 * Manages feature selection state for the map.
 * Tracks which features are selected and coordinates updates with selection overlay layers.
 */
export class MapSelectionManager {
	/** @type {SelectionStore} */
	selectionStore = $state({});
	/** @type {import('ol/layer/VectorTile').default[]} */
	selectionLayers = $state([]);

	/**
	 * Creates a new MapSelectionManager instance.
	 */
	constructor() {}

	/**
	 * Selects a single feature, clearing any previous selection.
	 * @param {string | number} featureId - The ID of the feature to select
	 * @param {import('ol/Feature').default | import('ol/render/Feature').default} feature - The feature object
	 * @returns {void}
	 */
	selectFeature(featureId, feature) {
		this.selectionStore = { [featureId]: feature };
		this.updateSelectionLayers();
	}

	/**
	 * Selects multiple features by their IDs, clearing any previous selection.
	 * @param {(string | number)[]} featureIds - Array of feature IDs to select
	 * @returns {void}
	 */
	selectMultipleFeatures(featureIds) {
		/** @type {SelectionStore} */
		const newSelection = {};
		featureIds.forEach((id) => {
			newSelection[id] = true;
		});
		this.selectionStore = newSelection;
		this.updateSelectionLayers();
	}

	/**
	 * Clears all feature selections.
	 * @returns {void}
	 */
	clearSelection() {
		this.selectionStore = {};
		this.updateSelectionLayers();
	}

	/**
	 * Checks if a feature is currently selected.
	 * @param {string | number} featureId - The ID of the feature to check
	 * @returns {boolean} True if the feature is selected
	 */
	isSelected(featureId) {
		return Boolean(this.selectionStore[featureId]);
	}

	/**
	 * Gets the currently selected feature (first one if multiple selected).
	 * @returns {import('ol/Feature').default | import('ol/render/Feature').default | true | null} The selected feature or null if none
	 */
	getSelectedFeature() {
		const ids = Object.keys(this.selectionStore);
		return ids.length > 0 ? this.selectionStore[ids[0]] : null;
	}

	/**
	 * Registers a layer to be updated when selection changes.
	 * @param {import('ol/layer/VectorTile').default} layer - OpenLayers layer that displays selection highlights
	 * @returns {void}
	 */
	registerSelectionLayer(layer) {
		if (layer && !this.selectionLayers.includes(layer)) {
			this.selectionLayers = [...this.selectionLayers, layer];
		}
	}

	/**
	 * Triggers re-render of all registered selection layers.
	 * @returns {void}
	 */
	updateSelectionLayers() {
		this.selectionLayers.forEach((layer) => {
			if (layer && layer.changed) {
				layer.changed();
			}
		});
	}

	/**
	 * Gets the selection store for use in layer style functions.
	 * @returns {SelectionStore} Selection state keyed by feature ID
	 */
	getSelectionStore() {
		return this.selectionStore;
	}

	/**
	 * Cleans up resources when the manager is destroyed.
	 * @returns {void}
	 */
	cleanup() {
		this.selectionStore = {};
		this.selectionLayers = [];
	}
}
