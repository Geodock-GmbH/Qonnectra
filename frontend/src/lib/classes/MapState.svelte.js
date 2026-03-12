import { get } from 'svelte/store';

import { m } from '$lib/paraglide/messages';

import {
	createAddressStyleWithLabels,
	createAreaStyleByType,
	createNodeStyleByType,
	createTrenchStyle,
	createTrenchStyleByAttribute
} from '$lib/map/styles';
import { tileLoadingManager } from '$lib/map/tileLoadingManager.js';
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from '$lib/map/tileSources';
import { getWorkerPool } from '$lib/map/workerPool.js';
import {
	getWMSLayerVisibility,
	setWMSLayerVisibility,
	wmsLayerVisibilityConfig,
	wmsSourcesData
} from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';
import { fetchWMSAccessToken, fetchWMSSources, getWMSProxyUrl } from '$lib/utils/wmsApi';
import { startWMSHeartbeat, stopWMSHeartbeat } from '$lib/utils/wmsTokenHeartbeat.svelte.js';
import {
	createAddressLayer,
	createAreaLayer,
	createNodeLayer,
	createSelectionLayer,
	createTrenchLayer,
	createWMSLayer
} from '$lib/map';

/**
 * @typedef {Object} LayerConfig
 * @property {boolean} trench
 * @property {boolean} address
 * @property {boolean} node
 * @property {boolean} area
 */

/**
 * @typedef {Object} LabelOptions
 * @property {boolean} enabled
 * @property {string} field
 * @property {number} minResolution
 */

/**
 * @typedef {Object} LabelConfig
 * @property {LabelOptions} trench
 * @property {LabelOptions} conduit
 * @property {LabelOptions} address
 * @property {LabelOptions} node
 * @property {LabelOptions} area
 */

/**
 * @typedef {Record<string, {color: string, visible?: boolean}>} TypeStyleMap
 */

/**
 * @typedef {Object} LabelUpdateStyles
 * @property {string} [mode]
 * @property {TypeStyleMap} [surfaceStyles]
 * @property {TypeStyleMap} [constructionTypeStyles]
 * @property {string} [color]
 * @property {TypeStyleMap} [nodeTypeStyles]
 * @property {TypeStyleMap} [areaTypeStyles]
 */

/**
 * @typedef {Object} LayerReferences
 * @property {import('ol/layer/VectorTile').default | null} vectorTileLayer
 * @property {import('ol/layer/VectorTile').default | null} addressLayer
 * @property {import('ol/layer/VectorTile').default | null} nodeLayer
 * @property {import('ol/layer/VectorTile').default | null} areaLayer
 */

const DEFAULT_TRENCH_COLOR = '#000000';
const DEFAULT_SELECTED_COLOR = '#000000';
const DEFAULT_ADDRESS_COLOR = '#2563eb';
const DEFAULT_ADDRESS_SIZE = 4;

/**
 * Main state manager for the map
 * Manages layers, tile sources, and map instance
 */
export class MapState {
	/** @type {import('ol').Map | null} */
	olMap = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	vectorTileLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	addressLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	nodeLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	areaLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	selectionLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	addressSelectionLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	nodeSelectionLayer = $state(null);
	/** @type {import('ol/layer/VectorTile').default | null} */
	areaSelectionLayer = $state(null);

	/** @type {import('ol/layer/Tile').default[]} */
	wmsLayers = $state([]);

	/** @type {import('ol/source/VectorTile').default | null} */
	tileSource = $state(null);
	/** @type {import('ol/source/VectorTile').default | null} */
	addressTileSource = $state(null);
	/** @type {import('ol/source/VectorTile').default | null} */
	nodeTileSource = $state(null);
	/** @type {import('ol/source/VectorTile').default | null} */
	areaTileSource = $state(null);

	/** @type {string} */
	selectedProject = $state('');
	/** @type {string} */
	selectedColor = $state(DEFAULT_SELECTED_COLOR);
	/** @type {string} */
	addressColor = $state(DEFAULT_ADDRESS_COLOR);
	/** @type {number} */
	addressSize = $state(DEFAULT_ADDRESS_SIZE);
	/** @type {boolean} */
	isGlobalView = $state(false);

	/** @type {LayerConfig} */
	layerConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});

	/** @type {LabelConfig} */
	labelConfig = $state({
		trench: { enabled: false, field: 'id_trench', minResolution: 1.5 },
		conduit: { enabled: false, field: 'conduit_names', minResolution: 1.5 },
		address: { enabled: false, field: 'street', minResolution: 1.0 },
		node: { enabled: false, field: 'name', minResolution: 1.0 },
		area: { enabled: false, field: 'name', minResolution: 5.0 }
	});

	/**
	 * @param {string} selectedProject - Current project ID
	 * @param {string} selectedColor - Color for selected features (optional, for selection layers)
	 * @param {LayerConfig | null} layerConfig - Configuration for which layers to load (optional)
	 * @param {LabelConfig | null} labelConfig - Configuration for text labels on layers (optional)
	 * @param {boolean} isGlobalView - Whether global view is active (optional)
	 */
	constructor(
		selectedProject,
		selectedColor = DEFAULT_SELECTED_COLOR,
		layerConfig = null,
		labelConfig = null,
		isGlobalView = false
	) {
		this.selectedProject = selectedProject;
		this.selectedColor = selectedColor;
		this.isGlobalView = isGlobalView;

		if (layerConfig) {
			this.layerConfig = { ...this.layerConfig, ...layerConfig };
		}

		if (labelConfig) {
			this.labelConfig = { ...this.labelConfig, ...labelConfig };
		}
	}

	/**
	 * Initialize layers and tile sources
	 * @returns {boolean} True if initialization succeeded
	 */
	initializeLayers() {
		try {
			if (this.layerConfig.trench) {
				this.tileSource = createTrenchTileSource(
					this.selectedProject,
					this.handleTileError,
					this.isGlobalView
				);
				this.vectorTileLayer = createTrenchLayer(
					/** @type {any} */ (this.selectedProject),
					m.nav_trench(),
					this.handleTileError,
					this.labelConfig.trench
				);
			}

			if (this.layerConfig.address) {
				this.addressTileSource = createAddressTileSource(
					this.selectedProject,
					this.handleTileError,
					this.isGlobalView
				);
				this.addressLayer = createAddressLayer(
					/** @type {any} */ (this.selectedProject),
					m.form_address({ count: 1 }),
					this.handleTileError,
					this.labelConfig.address
				);
			}

			if (this.layerConfig.node) {
				this.nodeTileSource = createNodeTileSource(
					this.selectedProject,
					this.handleTileError,
					this.isGlobalView
				);
				this.nodeLayer = createNodeLayer(
					/** @type {any} */ (this.selectedProject),
					m.form_node(),
					this.handleTileError,
					this.labelConfig.node
				);
			}

			if (this.layerConfig.area) {
				this.areaTileSource = createAreaTileSource(
					this.selectedProject,
					this.handleTileError,
					this.isGlobalView
				);
				this.areaLayer = createAreaLayer(
					/** @type {any} */ (this.selectedProject),
					m.form_area(),
					this.handleTileError,
					this.labelConfig.area
				);
			}

			return true;
		} catch (error) {
			globalToaster.error({
				title: m.title_error_initializing_map_tiles(),
				description: /** @type {Error} */ (error).message || 'Could not set up the tile layer.'
			});

			this.vectorTileLayer = null;
			this.tileSource = null;
			this.addressLayer = null;
			this.addressTileSource = null;
			this.nodeLayer = null;
			this.nodeTileSource = null;
			this.areaLayer = null;
			this.areaTileSource = null;

			return false;
		}
	}

	/**
	 * Load WMS layers from the backend.
	 * Only runs in browser context (not during SSR).
	 */
	async loadWMSLayers() {
		// Guard against SSR - fetch requires browser context with auth cookies
		if (typeof window === 'undefined') {
			return;
		}

		// Capture project at start of async operation
		const projectAtStart = this.selectedProject;

		try {
			// Fetch access token and sources in parallel
			const [accessToken, sources] = await Promise.all([
				fetchWMSAccessToken(),
				fetchWMSSources(projectAtStart)
			]);

			// Abort if project changed during fetch
			if (this.selectedProject !== projectAtStart) {
				return;
			}

			wmsSourcesData.set({ sources, loaded: true });

			const newWmsLayers = [];
			const validLayerIds = new Set();

			for (const source of sources) {
				if (!source.is_active) continue;

				for (const layer of source.layers) {
					if (!layer.is_enabled) continue;

					const layerId = `wms-${source.id}-${layer.name}`;
					validLayerIds.add(layerId);

					const olLayer = createWMSLayer({
						proxyUrl: getWMSProxyUrl(source.id, accessToken),
						layerName: layer.name,
						layerId: layerId,
						displayName: `${source.name}: ${layer.title || layer.name}`,
						sourceId: source.id,
						sourceName: source.name,
						minZoom: layer.min_zoom ?? 8,
						maxZoom: layer.max_zoom ?? undefined,
						opacity: layer.opacity ?? 1.0
					});

					// Get visibility from project-scoped store or default to true
					const visibilityStore = get(wmsLayerVisibilityConfig);
					const isVisible = getWMSLayerVisibility(visibilityStore, projectAtStart, layerId, true);
					olLayer.setVisible(isVisible);

					newWmsLayers.push(olLayer);
				}
			}

			// Final check before modifying state
			if (this.selectedProject !== projectAtStart) {
				return;
			}

			// Clean up stale visibility config entries for this project only
			const currentVisibilityConfig = get(wmsLayerVisibilityConfig);
			const projectConfig = currentVisibilityConfig[projectAtStart] || {};
			/** @type {Record<string, boolean>} */
			const cleanedProjectConfig = {};
			for (const [layerId, visible] of Object.entries(projectConfig)) {
				if (validLayerIds.has(layerId)) {
					cleanedProjectConfig[layerId] = visible;
				}
			}
			wmsLayerVisibilityConfig.set({
				...currentVisibilityConfig,
				[projectAtStart]: cleanedProjectConfig
			});

			this.wmsLayers = newWmsLayers;

			// Start WMS token heartbeat if we have WMS layers
			if (newWmsLayers.length > 0) {
				startWMSHeartbeat(this.updateWMSLayerTokens.bind(this), accessToken);
			}

			// Add WMS layers to the map if it's already initialized
			// Insert after base layers but before data layers
			if (this.olMap) {
				const layers = this.olMap.getLayers();
				let insertIndex = 0;
				layers.forEach((layer, index) => {
					if (layer.get('isBaseLayer')) {
						insertIndex = index + 1;
					}
				});

				for (const layer of this.wmsLayers) {
					layers.insertAt(insertIndex, layer);
					insertIndex++;
				}
			}
		} catch (error) {
			console.warn('Failed to load WMS layers:', error);
		}
	}

	/**
	 * Initialize selection layers after map is ready
	 * @param {import('ol').Map} olMap - OpenLayers map instance
	 * @param {() => Record<string, boolean>} getSelectionStore - Function to get current selection store
	 */
	initializeSelectionLayers(olMap, getSelectionStore) {
		if (!olMap || !this.tileSource) return;

		this.olMap = olMap;

		this.selectionLayer = createSelectionLayer(
			this.tileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.selectionLayer);

		this.addressSelectionLayer = createSelectionLayer(
			this.addressTileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.addressSelectionLayer);

		this.nodeSelectionLayer = createSelectionLayer(
			this.nodeTileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.nodeSelectionLayer);

		if (this.areaTileSource) {
			this.areaSelectionLayer = createSelectionLayer(
				this.areaTileSource,
				this.selectedColor,
				getSelectionStore
			);
			this.olMap.addLayer(this.areaSelectionLayer);
		}

		// Load WMS layers after map is ready (ensures this.olMap is set)
		this.loadWMSLayers();
	}

	/**
	 * Refresh all tile sources
	 */
	refreshTileSources() {
		if (this.tileSource && this.layerConfig.trench) {
			this.tileSource.refresh();
		}
		if (this.addressTileSource && this.layerConfig.address) {
			this.addressTileSource.refresh();
		}
		if (this.nodeTileSource && this.layerConfig.node) {
			this.nodeTileSource.refresh();
		}
		if (this.areaTileSource && this.layerConfig.area) {
			this.areaTileSource.refresh();
		}
	}

	/**
	 * Recreate all tile sources with current project and global view settings
	 * @private
	 */
	_recreateTileSources() {
		if (this.vectorTileLayer && this.layerConfig.trench) {
			const oldSource = this.vectorTileLayer.getSource();
			if (oldSource) oldSource.clear();
			this.tileSource = createTrenchTileSource(
				this.selectedProject,
				this.handleTileError,
				this.isGlobalView
			);
			this.vectorTileLayer.setSource(this.tileSource);
			if (this.selectionLayer) this.selectionLayer.setSource(this.tileSource);
		}

		if (this.addressLayer && this.layerConfig.address) {
			const oldSource = this.addressLayer.getSource();
			if (oldSource) oldSource.clear();
			this.addressTileSource = createAddressTileSource(
				this.selectedProject,
				this.handleTileError,
				this.isGlobalView
			);
			this.addressLayer.setSource(this.addressTileSource);
			if (this.addressSelectionLayer) this.addressSelectionLayer.setSource(this.addressTileSource);
		}

		if (this.nodeLayer && this.layerConfig.node) {
			const oldSource = this.nodeLayer.getSource();
			if (oldSource) oldSource.clear();
			this.nodeTileSource = createNodeTileSource(
				this.selectedProject,
				this.handleTileError,
				this.isGlobalView
			);
			this.nodeLayer.setSource(this.nodeTileSource);
			if (this.nodeSelectionLayer) this.nodeSelectionLayer.setSource(this.nodeTileSource);
		}

		if (this.areaLayer && this.layerConfig.area) {
			const oldSource = this.areaLayer.getSource();
			if (oldSource) oldSource.clear();
			this.areaTileSource = createAreaTileSource(
				this.selectedProject,
				this.handleTileError,
				this.isGlobalView
			);
			this.areaLayer.setSource(this.areaTileSource);
			if (this.areaSelectionLayer) this.areaSelectionLayer.setSource(this.areaTileSource);
		}
	}

	/**
	 * Reinitialize tile sources for a new project
	 * Clears cached tiles and creates new sources with the new project ID
	 * @param {string} newProjectId - The new project ID
	 */
	reinitializeForProject(newProjectId) {
		if (this.selectedProject === newProjectId) return;
		this.selectedProject = newProjectId;

		// Cancel old tile requests RIGHT BEFORE creating new sources.
		// This ensures old requests are aborted while new sources get fresh AbortControllers.
		tileLoadingManager.cancelAllRequests();
		getWorkerPool().cancelAllRequests();

		this._recreateTileSources();
		this._reloadWMSLayers();
	}

	/**
	 * Remove existing WMS layers and reload for current project
	 */
	async _reloadWMSLayers() {
		if (!this.olMap) return;

		// Remove existing WMS layers from map
		for (const wmsLayer of this.wmsLayers) {
			this.olMap.removeLayer(wmsLayer);
			const source = wmsLayer.getSource();
			if (source && typeof source.dispose === 'function') {
				source.dispose();
			}
		}
		this.wmsLayers = [];

		// Load WMS layers for the new project
		await this.loadWMSLayers();
	}

	/**
	 * Reinitialize tile sources for global view mode change
	 * @param {boolean} isGlobal - Whether global view is active
	 */
	reinitializeForGlobalView(isGlobal) {
		if (this.isGlobalView === isGlobal) return;
		this.isGlobalView = isGlobal;
		this._recreateTileSources();
	}

	/**
	 * Get all layers as an array for passing to Map component
	 * WMS layers are added first (at bottom), then area, then other layers
	 * @returns {import('ol/layer/Base').default[]}
	 */
	getLayers() {
		/** @type {import('ol/layer/Base').default[]} */
		const layers = [];

		// WMS layers at the bottom
		for (const wmsLayer of this.wmsLayers) {
			layers.push(wmsLayer);
		}

		if (this.areaLayer) layers.push(this.areaLayer);
		if (this.vectorTileLayer) layers.push(this.vectorTileLayer);
		if (this.addressLayer) layers.push(this.addressLayer);
		if (this.nodeLayer) layers.push(this.nodeLayer);

		return layers;
	}

	/**
	 * Get all selection layers for registration with SelectionManager
	 * @returns {import('ol/layer/VectorTile').default[]}
	 */
	getSelectionLayers() {
		return [
			this.selectionLayer,
			this.addressSelectionLayer,
			this.nodeSelectionLayer,
			this.areaSelectionLayer
		].filter(/** @returns {layer is import('ol/layer/VectorTile').default} */ (layer) => Boolean(layer));
	}

	/**
	 * Get layer references for interaction manager
	 * @returns {LayerReferences}
	 */
	getLayerReferences() {
		return {
			vectorTileLayer: this.vectorTileLayer,
			addressLayer: this.addressLayer,
			nodeLayer: this.nodeLayer,
			areaLayer: this.areaLayer
		};
	}

	/**
	 * Error handler for tile loading
	 * @param {string} message - Error title
	 * @param {string} description - Error description
	 */
	handleTileError = (message, description) => {
		globalToaster.error({
			title: message,
			description: description
		});
	};

	/**
	 * Update the node layer style based on node type styles
	 * @param {TypeStyleMap} nodeTypeStyles - Mapping of node type names to style config
	 */
	updateNodeLayerStyle(nodeTypeStyles) {
		if (!this.nodeLayer) return;

		const newStyle = createNodeStyleByType(nodeTypeStyles, this.labelConfig.node);
		this.nodeLayer.setStyle(/** @type {import('ol/style/Style').StyleLike} */ (newStyle));

		if (this.nodeTileSource) {
			this.nodeTileSource.refresh();
		}
	}

	/**
	 * Update the trench layer style based on style mode and attribute styles
	 * @param {string} styleMode - 'none' | 'surface' | 'construction_type'
	 * @param {TypeStyleMap} surfaceStyles - Mapping of surface names to style config
	 * @param {TypeStyleMap} constructionTypeStyles - Mapping of construction type names to style config
	 * @param {string} fallbackColor - Color to use when styleMode is 'none'
	 */
	updateTrenchLayerStyle(styleMode, surfaceStyles, constructionTypeStyles, fallbackColor) {
		if (!this.vectorTileLayer) return;

		let newStyle;
		if (styleMode === 'none') {
			newStyle = createTrenchStyle(
				fallbackColor,
				this.labelConfig.trench,
				this.labelConfig.conduit
			);
		} else {
			const attributeStyles = styleMode === 'surface' ? surfaceStyles : constructionTypeStyles;
			newStyle = createTrenchStyleByAttribute(
				attributeStyles,
				styleMode,
				fallbackColor,
				this.labelConfig.trench,
				this.labelConfig.conduit
			);
		}

		this.vectorTileLayer.setStyle(/** @type {import('ol/style/Style').StyleLike} */ (newStyle));

		if (this.tileSource) {
			this.tileSource.refresh();
		}
	}

	/**
	 * Update the address layer style with current label config and style settings
	 * @param {string} [color] - Optional color to update
	 * @param {number} [size] - Optional size to update
	 */
	updateAddressLayerStyle(color = undefined, size = undefined) {
		if (!this.addressLayer) return;

		if (color !== undefined) {
			this.addressColor = color;
		}
		if (size !== undefined) {
			this.addressSize = size;
		}

		const newStyle = createAddressStyleWithLabels(
			this.addressColor,
			this.addressSize,
			this.labelConfig.address
		);
		this.addressLayer.setStyle(/** @type {import('ol/style/Style').StyleLike} */ (newStyle));

		if (this.addressTileSource) {
			this.addressTileSource.refresh();
		}
	}

	/**
	 * Update the area layer style based on area type styles
	 * @param {TypeStyleMap} areaTypeStyles - Mapping of area type names to style config
	 */
	updateAreaLayerStyle(areaTypeStyles) {
		if (!this.areaLayer) return;

		const newStyle = createAreaStyleByType(areaTypeStyles, this.labelConfig.area);
		this.areaLayer.setStyle(/** @type {import('ol/style/Style').StyleLike} */ (newStyle));

		if (this.areaTileSource) {
			this.areaTileSource.refresh();
		}
	}

	/**
	 * Update label visibility for a specific layer type
	 * @param {keyof LabelConfig} layerType - 'trench' | 'address' | 'node' | 'area' | 'conduit'
	 * @param {boolean} enabled - Whether labels should be shown
	 * @param {LabelUpdateStyles} currentStyles - Current style settings
	 */
	updateLabelVisibility(layerType, enabled, currentStyles = {}) {
		const currentLabelConfig = this.labelConfig[layerType];
		if (currentLabelConfig.enabled === enabled) {
			return;
		}
		currentLabelConfig.enabled = enabled;

		switch (layerType) {
			case 'trench':
			case 'conduit':
				if (currentStyles.mode !== undefined) {
					this.updateTrenchLayerStyle(
						currentStyles.mode,
						currentStyles.surfaceStyles || {},
						currentStyles.constructionTypeStyles || {},
						currentStyles.color || DEFAULT_TRENCH_COLOR
					);
				}
				break;
			case 'address':
				this.updateAddressLayerStyle();
				break;
			case 'node':
				if (currentStyles.nodeTypeStyles) {
					this.updateNodeLayerStyle(currentStyles.nodeTypeStyles);
				}
				break;
			case 'area':
				if (currentStyles.areaTypeStyles) {
					this.updateAreaLayerStyle(currentStyles.areaTypeStyles);
				}
				break;
		}
	}

	/**
	 * Update WMS layer source URLs with a new token.
	 * Called by the WMS heartbeat when the token is refreshed.
	 * @param {string} newToken - The new WMS access token
	 */
	updateWMSLayerTokens(newToken) {
		for (const layer of this.wmsLayers) {
			const source = /** @type {import('ol/source/TileWMS').default} */ (layer.getSource());
			if (!source) continue;

			const urls = source.getUrls();
			if (!urls || urls.length === 0) continue;

			const currentUrl = urls[0];
			const newUrl = currentUrl.replace(/token=[^&]+/, `token=${encodeURIComponent(newToken)}`);
			source.setUrl(newUrl);
		}
	}

	/**
	 * Cleanup method to be called on destroy
	 */
	cleanup() {
		// Stop WMS token heartbeat
		stopWMSHeartbeat();

		if (!this.olMap) return;

		if (this.selectionLayer) {
			this.olMap.removeLayer(this.selectionLayer);
		}
		if (this.addressSelectionLayer) {
			this.olMap.removeLayer(this.addressSelectionLayer);
		}
		if (this.nodeSelectionLayer) {
			this.olMap.removeLayer(this.nodeSelectionLayer);
		}
		if (this.areaSelectionLayer) {
			this.olMap.removeLayer(this.areaSelectionLayer);
		}

		// Cleanup WMS layers
		for (const wmsLayer of this.wmsLayers) {
			this.olMap.removeLayer(wmsLayer);
			const source = wmsLayer.getSource();
			if (source) {
				source.dispose();
			}
		}

		const trenchSource = this.vectorTileLayer?.getSource();
		if (trenchSource) trenchSource.dispose();

		const addressSource = this.addressLayer?.getSource();
		if (addressSource) addressSource.dispose();

		const nodeSource = this.nodeLayer?.getSource();
		if (nodeSource) nodeSource.dispose();

		const areaSource = this.areaLayer?.getSource();
		if (areaSource) areaSource.dispose();

		this.olMap = null;
		this.vectorTileLayer = null;
		this.addressLayer = null;
		this.nodeLayer = null;
		this.areaLayer = null;
		this.selectionLayer = null;
		this.addressSelectionLayer = null;
		this.nodeSelectionLayer = null;
		this.areaSelectionLayer = null;
		this.tileSource = null;
		this.addressTileSource = null;
		this.nodeTileSource = null;
		this.areaTileSource = null;
		this.wmsLayers = [];
	}
}
