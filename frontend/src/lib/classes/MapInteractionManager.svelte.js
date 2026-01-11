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
	selectableLayersConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});
	additionalDrawerProps = $state({});

	/**
	 * @param {Object} selectionManager - MapSelectionManager instance
	 * @param {Object} popupManager - MapPopupManager instance
	 * @param {Object} drawerStore - Drawer store instance
	 * @param {Object} drawerComponent - MapDrawerTabs component
	 * @param {Object} alias - Field name alias mapping (English -> Localized)
	 * @param {Object} selectableLayersConfig - Configuration for which layers should open drawer on click (optional)
	 * @param {Object} additionalDrawerProps - Additional props to pass to drawer component (optional)
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
	 * @param {Object} props - Additional props object
	 */
	setAdditionalDrawerProps(props) {
		this.additionalDrawerProps = props;
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
	 * @param {Array} pixel - [x, y] pixel coordinates
	 * @returns {Array} Array of {feature, layer} objects at that pixel
	 */
	getClickedFeatures(pixel) {
		const clickedFeatures = [];
		const { vectorTileLayer, addressLayer, nodeLayer, areaLayer } = this.layers;

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
	 * Check if a layer is selectable based on configuration
	 * @param {Object} layer - OpenLayers layer
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
	 * @param {Object} feature - OpenLayers feature
	 * @param {Array} coordinate - Map coordinates [x, y]
	 * @param {Object} layer - OpenLayers layer (optional)
	 */
	handleFeatureClick(feature, coordinate, layer = null) {
		const featureId = feature.getId();

		if (featureId) {
			if (layer && !this.isLayerSelectable(layer)) {
				this.handleEmptyClick();
				return;
			}

			this.selectionManager.selectFeature(featureId, feature);

			const featureType = detectFeatureType(feature, layer);

			if (featureType && this.drawerStore && this.drawerComponent) {
				const rawProperties = feature.getProperties();
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
						...this.additionalDrawerProps
					}
				});
			} else {
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
		this.olMap = null;
		this.layers = {};
		this.searchPanelRef = null;
	}
}
