import {
	detectFeatureType,
	formatFeatureProperties,
	getFeatureTitle
} from '$lib/utils/featureUtils';

/**
 * @typedef {import('ol/Map').default} OlMap
 * @typedef {import('ol/Feature').default} OlFeature
 * @typedef {import('ol/layer/Layer').default} OlLayer
 */

/**
 * @typedef {Object} SelectableLayersConfig
 * @property {boolean} trench
 * @property {boolean} address
 * @property {boolean} node
 * @property {boolean} area
 */

/**
 * @typedef {Object} MapLayers
 * @property {OlLayer | null} [vectorTileLayer]
 * @property {OlLayer | null} [addressLayer]
 * @property {OlLayer | null} [nodeLayer]
 * @property {OlLayer | null} [areaLayer]
 */

/**
 * @typedef {Object} ClickedFeature
 * @property {OlFeature} feature
 * @property {OlLayer} layer
 */

/**
 * @typedef {Object} DrawerStore
 * @property {(options: {title?: string, component?: import('svelte').Component | null, props?: Record<string, any>, width?: number | null}) => void} open
 * @property {() => void} close
 */

/**
 * @typedef {Object} SearchPanelRef
 * @property {() => OlLayer} [getHighlightLayer]
 */

/**
 * Manages user interactions with the map
 * Handles click events, feature selection, and coordinates with other managers
 */
export class MapInteractionManager {
	/** @type {OlMap | null} */
	olMap = $state(null);
	/** @type {MapLayers} */
	layers = $state({});
	/** @type {import('./MapSelectionManager.svelte.js').MapSelectionManager | null} */
	selectionManager = $state(null);
	/** @type {import('./MapPopupManager.svelte.js').MapPopupManager | null} */
	popupManager = $state(null);
	/** @type {DrawerStore | null} */
	drawerStore = $state(null);
	/** @type {import('svelte').Component | null} */
	drawerComponent = $state(null);
	/** @type {Record<string, string>} */
	alias = $state({});
	/** @type {SearchPanelRef | null} */
	searchPanelRef = $state(null);
	/** @type {SelectableLayersConfig} */
	selectableLayersConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});
	/** @type {Record<string, any>} */
	additionalDrawerProps = $state({});

	/**
	 * @param {import('./MapSelectionManager.svelte.js').MapSelectionManager} selectionManager - MapSelectionManager instance
	 * @param {import('./MapPopupManager.svelte.js').MapPopupManager} popupManager - MapPopupManager instance
	 * @param {DrawerStore} drawerStore - Drawer store instance
	 * @param {import('svelte').Component} drawerComponent - MapDrawerTabs component
	 * @param {Record<string, string>} alias - Field name alias mapping (English -> Localized)
	 * @param {Partial<SelectableLayersConfig> | null} selectableLayersConfig - Configuration for which layers should open drawer on click (optional)
	 * @param {Record<string, any>} additionalDrawerProps - Additional props to pass to drawer component (optional)
	 */
	constructor(
		selectionManager,
		popupManager,
		drawerStore,
		drawerComponent,
		alias = {},
		selectableLayersConfig = null,
		additionalDrawerProps = {}
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
	 * Set additional props to pass to drawer component
	 * @param {Record<string, any>} props - Additional props object
	 */
	setAdditionalDrawerProps(props) {
		this.additionalDrawerProps = props;
	}

	/**
	 * Initialize interaction handlers on the map
	 * @param {OlMap} olMap - OpenLayers map instance
	 * @param {MapLayers} layers - Object containing layer references
	 * @param {SearchPanelRef | null} searchPanelRef - Reference to search panel component
	 * @returns {boolean} True if initialization succeeded
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
	 * @param {import('ol/MapBrowserEvent').default} event - OpenLayers map click event
	 */
	handleMapClick(event) {
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
	 * Get features at a given pixel
	 * @param {number[]} pixel - [x, y] pixel coordinates
	 * @returns {ClickedFeature[]} Array of {feature, layer} objects at that pixel
	 */
	getClickedFeatures(pixel) {
		/** @type {ClickedFeature[]} */
		const clickedFeatures = [];
		const { vectorTileLayer, addressLayer, nodeLayer, areaLayer } = this.layers;

		/** @type {OlLayer[]} */
		const layersToCheck = [];
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

		if (layersToCheck.length === 0 || !this.olMap) return clickedFeatures;

		this.olMap.forEachFeatureAtPixel(
			pixel,
			(feature, layer) => {
				clickedFeatures.push({
					feature: /** @type {OlFeature} */ (feature),
					layer: /** @type {OlLayer} */ (layer)
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
	 * Check if a layer is selectable based on configuration
	 * @param {OlLayer} layer - OpenLayers layer
	 * @returns {boolean} True if layer is selectable
	 */
	isLayerSelectable(layer) {
		const { vectorTileLayer, addressLayer, nodeLayer, areaLayer } = this.layers;

		if (layer === vectorTileLayer) return this.selectableLayersConfig.trench;
		if (layer === addressLayer) return this.selectableLayersConfig.address;
		if (layer === nodeLayer) return this.selectableLayersConfig.node;
		if (layer === areaLayer) return this.selectableLayersConfig.area;

		return false;
	}

	/**
	 * Handle click on a feature
	 * @param {OlFeature} feature - OpenLayers feature
	 * @param {number[]} coordinate - Map coordinates [x, y]
	 * @param {OlLayer | null} layer - OpenLayers layer (optional)
	 */
	handleFeatureClick(feature, coordinate, layer = null) {
		const featureId = feature.getId();

		if (featureId) {
			if (layer && !this.isLayerSelectable(layer)) {
				this.handleEmptyClick();
				return;
			}

			this.selectionManager?.selectFeature(String(featureId), feature);

			const featureType = detectFeatureType(feature, /** @type {Object} */ (layer));
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
	 * Handle click on empty area
	 */
	handleEmptyClick() {
		this.selectionManager?.clearSelection();
		this.popupManager?.hide();

		if (this.drawerStore) {
			this.drawerStore.close();
		}
	}

	/**
	 * Clear highlight from search panel
	 */
	clearSearchHighlight() {
		if (!this.searchPanelRef) return;

		if (this.searchPanelRef.getHighlightLayer) {
			const highlightLayer = this.searchPanelRef.getHighlightLayer();
			if (highlightLayer && highlightLayer.getSource()) {
				/** @type {any} */ (highlightLayer.getSource()).clear();
			}
		}
	}

	/**
	 * Update search panel reference
	 * @param {SearchPanelRef} ref - Search panel component reference
	 */
	setSearchPanelRef(ref) {
		this.searchPanelRef = ref;
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		this.olMap = null;
		this.layers = {};
		this.searchPanelRef = null;
	}
}
