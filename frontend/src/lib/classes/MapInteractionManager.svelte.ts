import type { MapPopupManager } from './MapPopupManager.svelte';
import type { MapSelectionManager } from './MapSelectionManager.svelte';
import type { DrawerStore } from '$lib/stores/drawer';
import type { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type LayerBase from 'ol/layer/Layer';
import type VectorLayer from 'ol/layer/Vector';
import type VectorTileLayer from 'ol/layer/VectorTile';
import type OlMap from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import type { Pixel } from 'ol/pixel';
import type RenderFeature from 'ol/render/Feature';
import type { Component } from 'svelte';

import {
	detectFeatureType,
	formatFeatureProperties,
	getFeatureTitle
} from '$lib/utils/featureUtils';

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
	getHighlightLayer?: () => VectorLayer;
}

/**
 * Manages user interactions with the map including click events, feature selection,
 * and coordination with selection and popup managers.
 */
export class MapInteractionManager {
	olMap: OlMap | null = $state(null);
	layers: LayerReferences = $state({});
	selectionManager: MapSelectionManager | null = $state(null);
	popupManager: MapPopupManager | null = $state(null);
	drawerStore: DrawerStore | null = $state(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	drawerComponent: Component<any> | null = $state(null);
	alias: Record<string, string> = $state({});
	searchPanelRef: SearchPanelRef | null = $state(null);
	selectableLayersConfig: SelectableLayersConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});
	additionalDrawerProps: Record<string, unknown> = $state({});

	/**
	 * Creates a new MapInteractionManager instance.
	 * @param selectionManager - Manages feature selection state
	 * @param popupManager - Manages map popups
	 * @param drawerStore - Drawer store for opening feature details
	 * @param drawerComponent - Component to render in drawer
	 * @param alias - Field name alias mapping (English -> Localized)
	 * @param selectableLayersConfig - Layer click behavior configuration
	 * @param additionalDrawerProps - Additional props passed to drawer component
	 */
	constructor(
		selectionManager: MapSelectionManager,
		popupManager: MapPopupManager,
		drawerStore: DrawerStore | null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		drawerComponent: Component<any> | null,
		alias: Record<string, string> = {},
		selectableLayersConfig: SelectableLayersConfig | null = null,
		additionalDrawerProps: Record<string, unknown> = {}
	) {
		this.selectionManager = selectionManager;
		this.popupManager = popupManager;
		this.drawerStore = drawerStore;
		this.drawerComponent = drawerComponent;
		this.alias = alias;
		this.additionalDrawerProps = additionalDrawerProps;

		if (selectableLayersConfig) {
			this.selectableLayersConfig = { ...this.selectableLayersConfig, ...selectableLayersConfig };
		}
	}

	/**
	 * Sets additional props to pass to the drawer component.
	 * @param props - Props object to merge with drawer props
	 */
	setAdditionalDrawerProps(props: Record<string, unknown>): void {
		this.additionalDrawerProps = props;
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
	 * Handles click on a map feature by selecting it and opening drawer or popup.
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

		if (featureId) {
			if (layer && !this.isLayerSelectable(layer)) {
				this.handleEmptyClick();
				return;
			}

			this.selectionManager?.selectFeature(featureId, feature);

			const featureType = detectFeatureType(feature, layer ?? undefined);
			const rawProperties = feature.getProperties();

			if (featureType && this.drawerStore && this.drawerComponent) {
				const properties = formatFeatureProperties(rawProperties, featureType);

				const title = getFeatureTitle(feature, featureType);

				this.drawerStore.open({
					title,
					component: this.drawerComponent,
					props: {
						featureData: properties,
						featureType,
						featureId,
						alias: this.alias,
						featureProjectId: rawProperties.project ? String(rawProperties.project) : null,
						...this.additionalDrawerProps
					}
				});
			} else {
				this.popupManager?.show(coordinate, feature);
			}
		} else {
			this.handleEmptyClick();
		}
	}

	/**
	 * Handles click on empty map area by clearing selection and closing drawer/popup.
	 */
	handleEmptyClick(): void {
		this.selectionManager?.clearSelection();
		this.popupManager?.hide();

		if (this.drawerStore) {
			this.drawerStore.close();
		}
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
