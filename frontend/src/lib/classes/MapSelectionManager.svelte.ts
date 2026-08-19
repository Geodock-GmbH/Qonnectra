import type Feature from 'ol/Feature.js';
import type VectorTileLayer from 'ol/layer/VectorTile.js';
import type RenderFeature from 'ol/render/Feature.js';

type SelectionStore = Record<string | number, Feature | RenderFeature | true>;

/**
 * Manages feature selection state for the map.
 * Tracks which features are selected and coordinates updates with selection overlay layers.
 */
export class MapSelectionManager {
	selectionStore: SelectionStore = $state({});
	selectionLayers: VectorTileLayer[] = $state([]);

	/**
	 * Creates a new MapSelectionManager instance.
	 */
	constructor() {}

	/**
	 * Selects a single feature, clearing any previous selection.
	 * @param featureId - The ID of the feature to select
	 * @param feature - The feature object
	 */
	selectFeature(featureId: string | number, feature: Feature | RenderFeature): void {
		this.selectionStore = { [featureId]: feature };
		this.updateSelectionLayers();
	}

	/**
	 * Selects multiple features by their IDs, clearing any previous selection.
	 * @param featureIds - Array of feature IDs to select
	 */
	selectMultipleFeatures(featureIds: (string | number)[]): void {
		const newSelection: SelectionStore = {};
		featureIds.forEach((id) => {
			newSelection[id] = true;
		});
		this.selectionStore = newSelection;
		this.updateSelectionLayers();
	}

	/**
	 * Clears all feature selections.
	 */
	clearSelection(): void {
		this.selectionStore = {};
		this.updateSelectionLayers();
	}

	/**
	 * Checks if a feature is currently selected.
	 * @param featureId - The ID of the feature to check
	 * @returns True if the feature is selected
	 */
	isSelected(featureId: string | number): boolean {
		return Boolean(this.selectionStore[featureId]);
	}

	/**
	 * Gets the currently selected feature (first one if multiple selected).
	 * @returns The selected feature or null if none
	 */
	getSelectedFeature(): Feature | RenderFeature | true | null {
		const ids = Object.keys(this.selectionStore);
		return ids.length > 0 ? this.selectionStore[ids[0]] : null;
	}

	/**
	 * Registers a layer to be updated when selection changes.
	 * @param layer - OpenLayers layer that displays selection highlights
	 */
	registerSelectionLayer(layer: VectorTileLayer): void {
		if (layer && !this.selectionLayers.includes(layer)) {
			this.selectionLayers = [...this.selectionLayers, layer];
		}
	}

	/**
	 * Triggers re-render of all registered selection layers.
	 */
	updateSelectionLayers(): void {
		this.selectionLayers.forEach((layer) => {
			if (layer && layer.changed) {
				layer.changed();
			}
		});
	}

	/**
	 * Gets the selection store for use in layer style functions.
	 * @returns Selection state keyed by feature ID
	 */
	getSelectionStore(): SelectionStore {
		return this.selectionStore;
	}

	/**
	 * Cleans up resources when the manager is destroyed.
	 */
	cleanup(): void {
		this.selectionStore = {};
		this.selectionLayers = [];
	}
}
