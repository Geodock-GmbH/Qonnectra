import {
	detectFeatureType,
	formatFeatureProperties,
	getFeatureTitle
} from '$lib/utils/featureUtils';

/**
 * @typedef {Object} SelectableLayersConfig
 * @property {boolean} trench - Whether trench layer features open drawer on click
 * @property {boolean} address - Whether address layer features open drawer on click
 * @property {boolean} node - Whether node layer features open drawer on click
 * @property {boolean} area - Whether area layer features open drawer on click
 */

/**
 * @typedef {Object} LayerReferences
 * @property {import('ol/layer/VectorTile').default | null} [vectorTileLayer] - Trench vector tile layer
 * @property {import('ol/layer/VectorTile').default | null} [addressLayer] - Address vector tile layer
 * @property {import('ol/layer/VectorTile').default | null} [nodeLayer] - Node vector tile layer
 * @property {import('ol/layer/VectorTile').default | null} [areaLayer] - Area vector tile layer
 */

/**
 * @typedef {Object} ClickedFeature
 * @property {import('ol/Feature').default | import('ol/render/Feature').default} feature - The clicked feature
 * @property {import('ol/layer/Layer').default | null} layer - The layer containing the feature
 */

/**
 * Manages user interactions with the map including click events, feature selection,
 * and coordination with selection and popup managers.
 */
export class MapInteractionManager {
	/** @type {import('ol/Map').default | null} */
	olMap = $state(null);
	/** @type {LayerReferences} */
	layers = $state({});
	/** @type {import('./MapSelectionManager.svelte.js').MapSelectionManager | null} */
	selectionManager = $state(null);
	/** @type {import('./MapPopupManager.svelte.js').MapPopupManager | null} */
	popupManager = $state(null);
	/** @type {{ open: Function; close: Function } | null} */
	drawerStore = $state(null);
	/** @type {import('svelte').Component | null} */
	drawerComponent = $state(null);
	/** @type {Record<string, string>} */
	alias = $state({});
	/** @type {{ getHighlightLayer?: () => import('ol/layer/Vector').default } | null} */
	searchPanelRef = $state(null);
	/** @type {SelectableLayersConfig} */
	selectableLayersConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});
	/** @type {Record<string, unknown>} */
	additionalDrawerProps = $state({});

	/**
	 * Creates a new MapInteractionManager instance.
	 * @param {import('./MapSelectionManager.svelte.js').MapSelectionManager} selectionManager - Manages feature selection state
	 * @param {import('./MapPopupManager.svelte.js').MapPopupManager} popupManager - Manages map popups
	 * @param {{ open: Function; close: Function } | null} drawerStore - Drawer store for opening feature details
	 * @param {import('svelte').Component | null} drawerComponent - Component to render in drawer
	 * @param {Record<string, string>} [alias={}] - Field name alias mapping (English -> Localized)
	 * @param {SelectableLayersConfig | null} [selectableLayersConfig=null] - Layer click behavior configuration
	 * @param {Record<string, unknown>} [additionalDrawerProps={}] - Additional props passed to drawer component
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
	 * Sets additional props to pass to the drawer component.
	 * @param {Record<string, unknown>} props - Props object to merge with drawer props
	 * @returns {void}
	 */
	setAdditionalDrawerProps(props) {
		this.additionalDrawerProps = props;
	}

	/**
	 * Initializes interaction handlers on the map instance.
	 * @param {import('ol/Map').default} olMap - OpenLayers map instance
	 * @param {LayerReferences} layers - Object containing vector tile layer references
	 * @param {{ getHighlightLayer?: () => import('ol/layer/Vector').default } | null} [searchPanelRef=null] - Reference to search panel component
	 * @returns {boolean} True if initialization succeeded, false if map instance missing
	 */
	initialize(olMap, layers, searchPanelRef = null) {
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
	 * @param {import('ol/MapBrowserEvent').default} event - OpenLayers map click event
	 * @returns {void}
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
	 * Gets all features at a given pixel location from selectable layers.
	 * @param {import('ol/pixel').Pixel} pixel - Pixel coordinates [x, y]
	 * @returns {ClickedFeature[]} Array of feature/layer pairs at that pixel
	 */
	getClickedFeatures(pixel) {
		/** @type {ClickedFeature[]} */
		const clickedFeatures = [];
		const { vectorTileLayer, addressLayer, nodeLayer, areaLayer } = this.layers;

		/** @type {import('ol/layer/Layer').default[]} */
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

		if (layersToCheck.length === 0) return clickedFeatures;

		this.olMap?.forEachFeatureAtPixel(
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
	 * Checks if a layer is configured to be selectable.
	 * @param {import('ol/layer/Layer').default} layer - OpenLayers layer to check
	 * @returns {boolean} True if clicking features on this layer should trigger selection
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
	 * Handles click on a map feature by selecting it and opening drawer or popup.
	 * @param {import('ol/Feature').default | import('ol/render/Feature').default} feature - Clicked feature
	 * @param {import('ol/coordinate').Coordinate} coordinate - Map coordinates [x, y]
	 * @param {import('ol/layer/Layer').default | null} [layer=null] - Layer containing the feature
	 * @returns {void}
	 */
	handleFeatureClick(feature, coordinate, layer = null) {
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
	 * @returns {void}
	 */
	handleEmptyClick() {
		this.selectionManager?.clearSelection();
		this.popupManager?.hide();

		if (this.drawerStore) {
			this.drawerStore.close();
		}
	}

	/**
	 * Clears the search highlight layer when present.
	 * @returns {void}
	 */
	clearSearchHighlight() {
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
	 * @param {{ getHighlightLayer?: () => import('ol/layer/Vector').default } | null} ref - Search panel component reference
	 * @returns {void}
	 */
	setSearchPanelRef(ref) {
		this.searchPanelRef = ref;
	}

	/**
	 * Cleans up resources when the manager is destroyed.
	 * @returns {void}
	 */
	cleanup() {
		this.olMap = null;
		this.layers = {};
		this.searchPanelRef = null;
	}
}
