import type { MapPopupManager } from './MapPopupManager.svelte';
import type { MapSelectionManager } from './MapSelectionManager.svelte';
import type { MapFeatureKind } from '$lib/map/featureDetails';
import type { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type LayerBase from 'ol/layer/Layer';
import type VectorLayer from 'ol/layer/Vector';
import type VectorTileLayer from 'ol/layer/VectorTile';
import type OlMap from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import type { Pixel } from 'ol/pixel';
import type RenderFeature from 'ol/render/Feature';

import { detectFeatureType } from '$lib/utils/featureUtils';

interface SelectableLayersConfig {
	trench: boolean;
	address: boolean;
	node: boolean;
	area: boolean;
}

interface LayerReferences {
	vectorTileLayer?: VectorTileLayer | null;
	addressLayer?: VectorTileLayer | null;
	nodeLayer?: VectorTileLayer | null;
	areaLayer?: VectorTileLayer | null;
}

interface ClickedFeature {
	feature: Feature | RenderFeature;
	layer: LayerBase | null;
}

export interface SearchPanelRef {
	getHighlightLayer?: () => VectorLayer | undefined;
}

export interface MapInteractionOptions {
	/** Which layers respond to clicks; the rest are left to the popup. */
	selectableLayers?: Partial<SelectableLayersConfig> | null;
	/**
	 * Called when a feature of a known kind was clicked. The page turns this
	 * into the URL, which is what opens the drawer; the manager never
	 * navigates itself.
	 */
	onFeatureSelected?: (kind: MapFeatureKind, uuid: string) => void;
	/** Called when empty map was clicked, so the page can close the drawer. */
	onSelectionCleared?: () => void;
}

/**
 * Manages user interactions with the map including click events, feature selection,
 * and coordination with the selection and popup managers. Which feature is
 * open lives in the URL; this class only reports what was clicked.
 */
export class MapInteractionManager {
	olMap: OlMap | null = $state(null);
	layers: LayerReferences = $state({});
	selectionManager: MapSelectionManager | null = $state(null);
	popupManager: MapPopupManager | null = $state(null);
	searchPanelRef: SearchPanelRef | null = $state(null);
	selectableLayersConfig: SelectableLayersConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});
	onFeatureSelected: ((kind: MapFeatureKind, uuid: string) => void) | undefined;
	onSelectionCleared: (() => void) | undefined;

	/**
	 * Creates a new MapInteractionManager instance.
	 * @param selectionManager - Manages feature selection state
	 * @param popupManager - Manages map popups
	 * @param options - Selectable layers and the selection callbacks
	 */
	constructor(
		selectionManager: MapSelectionManager,
		popupManager: MapPopupManager,
		options: MapInteractionOptions = {}
	) {
		this.selectionManager = selectionManager;
		this.popupManager = popupManager;
		this.onFeatureSelected = options.onFeatureSelected;
		this.onSelectionCleared = options.onSelectionCleared;

		if (options.selectableLayers) {
			this.selectableLayersConfig = { ...this.selectableLayersConfig, ...options.selectableLayers };
		}
	}

	/**
	 * Initializes interaction handlers on the map instance.
	 * @param olMap - OpenLayers map instance
	 * @param layers - Object containing vector tile layer references
	 * @param searchPanelRef - Reference to search panel component
	 */
	initialize(
		olMap: OlMap,
		layers: LayerReferences,
		searchPanelRef: SearchPanelRef | null = null
	): boolean {
		if (!olMap) {
			console.error('Map instance is required');
			return false;
		}

		this.olMap = olMap;
		this.layers = layers;
		this.searchPanelRef = searchPanelRef;

		this.olMap.on('click', (event) => this.handleMapClick(event));

		return true;
	}

	/**
	 * Handles map click events by detecting features and triggering appropriate actions.
	 * @param event - OpenLayers map click event
	 */
	handleMapClick(event: MapBrowserEvent): void {
		if (!this.olMap) return;

		this.clearSearchHighlight();

		const clickedFeatures = this.getClickedFeatures(event.pixel);

		if (clickedFeatures.length > 0) {
			const { feature, layer } = clickedFeatures[0];
			this.handleFeatureClick(feature, event.coordinate, layer);
		} else {
			this.handleEmptyClick();
		}
	}

	/**
	 * Gets all features at a given pixel location from selectable layers.
	 * @param pixel - Pixel coordinates [x, y]
	 */
	getClickedFeatures(pixel: Pixel): ClickedFeature[] {
		const clickedFeatures: ClickedFeature[] = [];
		const { vectorTileLayer, addressLayer, nodeLayer, areaLayer } = this.layers;

		const layersToCheck: LayerBase[] = [];
		if (vectorTileLayer && this.selectableLayersConfig.trench) {
			layersToCheck.push(vectorTileLayer);
		}
		if (addressLayer && this.selectableLayersConfig.address) {
			layersToCheck.push(addressLayer);
		}
		if (nodeLayer && this.selectableLayersConfig.node) {
			layersToCheck.push(nodeLayer);
		}
		if (areaLayer && this.selectableLayersConfig.area) {
			layersToCheck.push(areaLayer);
		}

		if (layersToCheck.length === 0) return clickedFeatures;

		this.olMap?.forEachFeatureAtPixel(
			pixel,
			(feature, layer) => {
				clickedFeatures.push({
					feature: feature as Feature | RenderFeature,
					layer: layer as LayerBase | null
				});
			},
			{
				hitTolerance: 10,
				layerFilter: (layer) => layersToCheck.includes(layer)
			}
		);

		return clickedFeatures;
	}

	/**
	 * Checks if a layer is configured to be selectable.
	 * @param layer - OpenLayers layer to check
	 */
	isLayerSelectable(layer: LayerBase): boolean {
		const { vectorTileLayer, addressLayer, nodeLayer, areaLayer } = this.layers;

		if (layer === vectorTileLayer) return this.selectableLayersConfig.trench;
		if (layer === addressLayer) return this.selectableLayersConfig.address;
		if (layer === nodeLayer) return this.selectableLayersConfig.node;
		if (layer === areaLayer) return this.selectableLayersConfig.area;

		return false;
	}

	/**
	 * Handles a click on a map feature: selects it and reports its kind and
	 * uuid, or shows the popup for a feature of unknown kind.
	 * @param feature - Clicked feature
	 * @param coordinate - Map coordinates [x, y]
	 * @param layer - Layer containing the feature
	 */
	handleFeatureClick(
		feature: Feature | RenderFeature,
		coordinate: Coordinate,
		layer: LayerBase | null = null
	): void {
		const featureId = feature.getId();

		if (!featureId) {
			this.handleEmptyClick();
			return;
		}

		if (layer && !this.isLayerSelectable(layer)) {
			this.handleEmptyClick();
			return;
		}

		this.selectionManager?.selectFeature(featureId, feature);

		const kind = detectFeatureType(feature, layer ?? undefined);
		if (kind) {
			this.onFeatureSelected?.(kind, String(featureId));
		} else {
			this.popupManager?.show(coordinate, feature);
		}
	}

	/**
	 * Handles a click on empty map by clearing the selection and the popup
	 * and reporting the cleared selection.
	 */
	handleEmptyClick(): void {
		this.selectionManager?.clearSelection();
		this.popupManager?.hide();
		this.onSelectionCleared?.();
	}

	/**
	 * Clears the search highlight layer when present.
	 */
	clearSearchHighlight(): void {
		if (!this.searchPanelRef) return;

		if (this.searchPanelRef.getHighlightLayer) {
			const highlightLayer = this.searchPanelRef.getHighlightLayer();
			if (highlightLayer) {
				highlightLayer.getSource()?.clear();
			}
		}
	}

	/**
	 * Updates the search panel component reference.
	 * @param ref - Search panel component reference
	 */
	setSearchPanelRef(ref: SearchPanelRef | null): void {
		this.searchPanelRef = ref;
	}

	/**
	 * Cleans up resources when the manager is destroyed.
	 */
	cleanup(): void {
		this.olMap = null;
		this.layers = {};
		this.searchPanelRef = null;
	}
}
