import type {
	AreaTypeStyles,
	AttributeStyles,
	LabelOptions,
	NodeShape,
	NodeTypeStyles
} from '$lib/map/styles';
import type { Map } from 'ol';
import type BaseLayer from 'ol/layer/Base';
import type TileLayer from 'ol/layer/Tile';
import type VectorTileLayer from 'ol/layer/VectorTile';
import type TileWMS from 'ol/source/TileWMS';
import type VectorTileSource from 'ol/source/VectorTile';
import type { StyleLike } from 'ol/style/Style';
import { get } from 'svelte/store';

import { m } from '$lib/paraglide/messages';

import {
	createAddressStyleWithLabels,
	createAreaStyleByType,
	createNodeStyleByType,
	createTrenchStyle,
	createTrenchStyleByAttribute,
	DEFAULT_ADDRESS_COLOR,
	DEFAULT_ADDRESS_SIZE,
	DEFAULT_SELECTED_COLOR,
	DEFAULT_TRENCH_COLOR
} from '$lib/map/styles';
import { tileLoadingManager } from '$lib/map/tileLoadingManager';
import {
	createAddressTileSource,
	createAreaTileSource,
	createNodeTileSource,
	createTrenchTileSource
} from '$lib/map/tileSources';
import { getWorkerPool } from '$lib/map/workerPool';
import {
	getWMSLayerVisibility,
	setWMSLayerVisibility,
	wmsLayerVisibilityConfig,
	wmsSourcesData
} from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';
import { fetchWMSAccessToken, fetchWMSSources, getWMSProxyUrl } from '$lib/utils/wmsApi';
import {
	isWMSHeartbeatRunning,
	requestImmediateWMSRefresh,
	startWMSHeartbeat,
	stopWMSHeartbeat
} from '$lib/utils/wmsTokenHeartbeat.svelte';
import {
	createAddressLayer,
	createAreaLayer,
	createNodeLayer,
	createNodeSelectionLayer,
	createSelectionLayer,
	createTrenchLayer,
	createWMSLayer
} from '$lib/map';

interface LayerConfig {
	trench: boolean;
	address: boolean;
	node: boolean;
	area: boolean;
}

interface LabelConfigEntry {
	enabled: boolean;
	field: string;
	minResolution: number;
}

interface LabelConfig {
	trench: LabelConfigEntry;
	conduit: LabelConfigEntry;
	address: LabelConfigEntry;
	node: LabelConfigEntry;
	area: LabelConfigEntry;
}

type TypeStyleMap = Record<string, { color: string; visible?: boolean }>;

interface LabelUpdateStyles {
	mode?: string;
	surfaceStyles?: TypeStyleMap;
	constructionTypeStyles?: TypeStyleMap;
	color?: string;
	nodeTypeStyles?: TypeStyleMap;
	areaTypeStyles?: TypeStyleMap;
}

interface LayerReferences {
	vectorTileLayer: VectorTileLayer | null;
	addressLayer: VectorTileLayer | null;
	nodeLayer: VectorTileLayer | null;
	areaLayer: VectorTileLayer | null;
}

/**
 * Main state manager for the map
 * Manages layers, tile sources, and map instance
 */
export class MapState {
	olMap: Map | null = $state(null);
	vectorTileLayer: VectorTileLayer | null = $state(null);
	addressLayer: VectorTileLayer | null = $state(null);
	nodeLayer: VectorTileLayer | null = $state(null);
	areaLayer: VectorTileLayer | null = $state(null);
	selectionLayer: VectorTileLayer | null = $state(null);
	addressSelectionLayer: VectorTileLayer | null = $state(null);
	nodeSelectionLayer: VectorTileLayer | null = $state(null);
	areaSelectionLayer: VectorTileLayer | null = $state(null);

	wmsLayers: TileLayer<TileWMS>[] = $state([]);

	_visibilityHandler: (() => void) | null = null;

	tileSource: VectorTileSource | null = $state(null);
	addressTileSource: VectorTileSource | null = $state(null);
	nodeTileSource: VectorTileSource | null = $state(null);
	areaTileSource: VectorTileSource | null = $state(null);

	selectedProject: string = $state('');
	selectedColor: string = $state(DEFAULT_SELECTED_COLOR);
	addressColor: string = $state(DEFAULT_ADDRESS_COLOR);
	addressSize: number = $state(DEFAULT_ADDRESS_SIZE);
	isGlobalView: boolean = $state(false);

	layerConfig: LayerConfig = $state({
		trench: true,
		address: true,
		node: true,
		area: true
	});

	labelConfig: LabelConfig = $state({
		trench: { enabled: false, field: 'id_trench', minResolution: 1.5 },
		conduit: { enabled: false, field: 'conduit_names', minResolution: 1.5 },
		address: { enabled: false, field: 'street', minResolution: 1.0 },
		node: { enabled: false, field: 'name', minResolution: 1.0 },
		area: { enabled: false, field: 'name', minResolution: 5.0 }
	});

	/**
	 * @param selectedProject - Current project ID
	 * @param selectedColor - Color for selected features (optional, for selection layers)
	 * @param layerConfig - Configuration for which layers to load (optional)
	 * @param labelConfig - Configuration for text labels on layers (optional)
	 * @param isGlobalView - Whether global view is active (optional)
	 */
	constructor(
		selectedProject: string,
		selectedColor: string = DEFAULT_SELECTED_COLOR,
		layerConfig: LayerConfig | null = null,
		labelConfig: LabelConfig | null = null,
		isGlobalView: boolean = false
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
	 * Creates all configured vector tile layers and their tile sources.
	 * @returns True if initialization succeeded
	 */
	initializeLayers(): boolean {
		try {
			if (this.layerConfig.trench) {
				this.tileSource = createTrenchTileSource(
					this.selectedProject,
					this.handleTileError,
					this.isGlobalView
				);
				this.vectorTileLayer = createTrenchLayer(
					this.selectedProject,
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
					this.selectedProject,
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
					this.selectedProject,
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
					this.selectedProject,
					m.form_area(),
					this.handleTileError,
					this.labelConfig.area
				);
			}

			return true;
		} catch (error: unknown) {
			globalToaster.error({
				title: m.title_error_initializing_map_tiles(),
				description: (error as Error).message || 'Could not set up the tile layer.'
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
	 * Loads WMS layers from the backend and adds them to the map.
	 * Only runs in browser context (not during SSR).
	 */
	async loadWMSLayers(): Promise<void> {
		if (typeof window === 'undefined') {
			return;
		}

		const projectAtStart = this.selectedProject;

		try {
			const [accessToken, sources] = await Promise.all([
				fetchWMSAccessToken(),
				fetchWMSSources(projectAtStart)
			]);

			if (this.selectedProject !== projectAtStart) {
				return;
			}

			wmsSourcesData.set({ sources, loaded: true });

			const newWmsLayers: TileLayer<TileWMS>[] = [];
			const validLayerIds = new Set<string>();

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

					const visibilityStore = get(wmsLayerVisibilityConfig);
					const isVisible = getWMSLayerVisibility(visibilityStore, projectAtStart, layerId, true);
					olLayer.setVisible(isVisible);

					newWmsLayers.push(olLayer);
				}
			}

			if (this.selectedProject !== projectAtStart) {
				return;
			}

			const currentVisibilityConfig = get(wmsLayerVisibilityConfig);
			const projectConfig = currentVisibilityConfig[projectAtStart] || {};
			const cleanedProjectConfig: Record<string, boolean> = {};
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

			if (newWmsLayers.length > 0) {
				startWMSHeartbeat(
					this.updateWMSLayerTokens.bind(this),
					accessToken,
					this.pauseAllWMSLayers.bind(this)
				);
			}

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
		} catch (error: unknown) {
			console.warn('Failed to load WMS layers:', error);
		}
	}

	/**
	 * Creates and adds selection highlight layers after the map is initialized.
	 * Also triggers WMS layer loading.
	 * @param olMap - OpenLayers map instance
	 * @param getSelectionStore - Function to get current selection store
	 * @param getNodeTypeStyles - Function to get current node type styles
	 */
	initializeSelectionLayers(
		olMap: Map,
		getSelectionStore: () => Record<string, boolean>,
		getNodeTypeStyles?: () => Record<
			string,
			{ color?: string; size?: number; visible?: boolean; shape?: NodeShape }
		>
	): void {
		if (!olMap || !this.tileSource) return;

		this.olMap = olMap;

		this.selectionLayer = createSelectionLayer(
			this.tileSource,
			this.selectedColor,
			getSelectionStore
		);
		this.olMap.addLayer(this.selectionLayer);

		if (this.addressTileSource) {
			this.addressSelectionLayer = createSelectionLayer(
				this.addressTileSource,
				this.selectedColor,
				getSelectionStore
			);
			this.olMap.addLayer(this.addressSelectionLayer);
		}

		if (this.nodeTileSource) {
			this.nodeSelectionLayer = createNodeSelectionLayer(
				this.nodeTileSource,
				this.selectedColor,
				getSelectionStore,
				getNodeTypeStyles || (() => ({}))
			);
			this.olMap.addLayer(this.nodeSelectionLayer);
		}

		if (this.areaTileSource) {
			this.areaSelectionLayer = createSelectionLayer(
				this.areaTileSource,
				this.selectedColor,
				getSelectionStore
			);
			this.olMap.addLayer(this.areaSelectionLayer);
		}

		this.loadWMSLayers();

		this._visibilityHandler = this._handleVisibilityChange.bind(this);
		document.addEventListener('visibilitychange', this._visibilityHandler);
	}

	/** Refreshes all active tile sources to reload their data. */
	refreshTileSources(): void {
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
	 * Recreates all tile sources with current project and global view settings,
	 * clearing cached tiles and updating selection layers.
	 */
	private _recreateTileSources(): void {
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
	 * Reinitializes tile sources for a new project, cancelling in-flight requests
	 * and reloading WMS layers.
	 * @param newProjectId - The new project ID
	 */
	reinitializeForProject(newProjectId: string): void {
		if (this.selectedProject === newProjectId) return;
		this.selectedProject = newProjectId;

		tileLoadingManager.cancelAllRequests();
		getWorkerPool().cancelAllRequests();

		this._recreateTileSources();
		this._reloadWMSLayers();
	}

	/** Removes existing WMS layers from the map and reloads them for the current project. */
	async _reloadWMSLayers(): Promise<void> {
		if (!this.olMap) return;

		for (const wmsLayer of this.wmsLayers) {
			this.olMap.removeLayer(wmsLayer);
			const source = wmsLayer.getSource();
			if (source && typeof source.dispose === 'function') {
				source.dispose();
			}
		}
		this.wmsLayers = [];

		await this.loadWMSLayers();
	}

	/**
	 * Reinitializes tile sources when the global view mode changes.
	 * @param isGlobal - Whether global view is active
	 */
	reinitializeForGlobalView(isGlobal: boolean): void {
		if (this.isGlobalView === isGlobal) return;
		this.isGlobalView = isGlobal;
		this._recreateTileSources();
	}

	/** Returns all layers in draw order: WMS at bottom, then area, trench, address, node. */
	getLayers(): BaseLayer[] {
		const layers: BaseLayer[] = [];

		for (const wmsLayer of this.wmsLayers) {
			layers.push(wmsLayer);
		}

		if (this.areaLayer) layers.push(this.areaLayer);
		if (this.vectorTileLayer) layers.push(this.vectorTileLayer);
		if (this.addressLayer) layers.push(this.addressLayer);
		if (this.nodeLayer) layers.push(this.nodeLayer);

		return layers;
	}

	/** Returns all non-null selection layers for registration with MapSelectionManager. */
	getSelectionLayers(): VectorTileLayer[] {
		return [
			this.selectionLayer,
			this.addressSelectionLayer,
			this.nodeSelectionLayer,
			this.areaSelectionLayer
		].filter((layer): layer is VectorTileLayer => Boolean(layer));
	}

	/** Returns layer references for use by MapInteractionManager. */
	getLayerReferences(): LayerReferences {
		return {
			vectorTileLayer: this.vectorTileLayer,
			addressLayer: this.addressLayer,
			nodeLayer: this.nodeLayer,
			areaLayer: this.areaLayer
		};
	}

	/**
	 * Displays a toast notification for tile loading errors.
	 * @param message - Error title
	 * @param description - Error description
	 */
	handleTileError = (message: string, description: string): void => {
		globalToaster.error({
			title: message,
			description: description
		});
	};

	/**
	 * Updates the node layer style based on node type style mapping and refreshes tiles.
	 * @param nodeTypeStyles - Mapping of node type names to style config
	 */
	updateNodeLayerStyle(nodeTypeStyles: TypeStyleMap): void {
		if (!this.nodeLayer) return;

		const newStyle = createNodeStyleByType(nodeTypeStyles, this.labelConfig.node);
		this.nodeLayer.setStyle(newStyle as StyleLike);

		if (this.nodeTileSource) {
			this.nodeTileSource.refresh();
		}
	}

	/**
	 * Updates the trench layer style based on the selected style mode and refreshes tiles.
	 * @param styleMode - 'none' | 'surface' | 'construction_type'
	 * @param surfaceStyles - Mapping of surface names to style config
	 * @param constructionTypeStyles - Mapping of construction type names to style config
	 * @param fallbackColor - Color to use when styleMode is 'none'
	 */
	updateTrenchLayerStyle(
		styleMode: string,
		surfaceStyles: TypeStyleMap,
		constructionTypeStyles: TypeStyleMap,
		fallbackColor: string
	): void {
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
				styleMode as 'surface' | 'construction_type',
				fallbackColor,
				this.labelConfig.trench,
				this.labelConfig.conduit
			);
		}

		this.vectorTileLayer.setStyle(newStyle as StyleLike);

		if (this.tileSource) {
			this.tileSource.refresh();
		}
	}

	/**
	 * Updates the address layer style with optional color/size overrides and refreshes tiles.
	 * @param color - New address point color
	 * @param size - New address point size
	 */
	updateAddressLayerStyle(color?: string, size?: number): void {
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
		this.addressLayer.setStyle(newStyle as StyleLike);

		if (this.addressTileSource) {
			this.addressTileSource.refresh();
		}
	}

	/**
	 * Updates the area layer style based on area type style mapping and refreshes tiles.
	 * @param areaTypeStyles - Mapping of area type names to style config
	 */
	updateAreaLayerStyle(areaTypeStyles: TypeStyleMap): void {
		if (!this.areaLayer) return;

		const newStyle = createAreaStyleByType(areaTypeStyles, this.labelConfig.area);
		this.areaLayer.setStyle(newStyle as StyleLike);

		if (this.areaTileSource) {
			this.areaTileSource.refresh();
		}
	}

	/**
	 * Toggles label visibility for a specific layer type and re-applies the layer style.
	 * @param layerType - 'trench' | 'address' | 'node' | 'area' | 'conduit'
	 * @param enabled - Whether labels should be shown
	 * @param currentStyles - Current style settings needed for re-styling
	 */
	updateLabelVisibility(
		layerType: keyof LabelConfig,
		enabled: boolean,
		currentStyles: LabelUpdateStyles = {}
	): void {
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
	 * Sets the auth failure flag on all WMS layers to prevent further tile requests.
	 * Called by the heartbeat when authentication fails.
	 */
	pauseAllWMSLayers(): void {
		for (const layer of this.wmsLayers) {
			const source = layer.getSource() as TileWMS;
			if (!source) continue;

			const setAuthFailed = source.get('setAuthFailed');
			if (typeof setAuthFailed === 'function') {
				setAuthFailed();
			}
		}
	}

	/**
	 * Attempts to recover WMS layers when the user returns to the tab.
	 * If the heartbeat was stopped due to auth failure and the session has since
	 * recovered, restarts the heartbeat and refreshes all layer tokens.
	 */
	async _handleVisibilityChange(): Promise<void> {
		if (document.visibilityState !== 'visible') return;
		if (this.wmsLayers.length === 0) return;

		if (isWMSHeartbeatRunning()) {
			requestImmediateWMSRefresh(true);
			return;
		}

		try {
			const token = await fetchWMSAccessToken();
			startWMSHeartbeat(
				this.updateWMSLayerTokens.bind(this),
				token,
				this.pauseAllWMSLayers.bind(this)
			);
			this.updateWMSLayerTokens();
		} catch {
			// Session still expired
		}
	}

	/**
	 * Recovers WMS layers after a token refresh. Tiles read the current token
	 * at request time, so layer URLs don't need rewriting -- this unpauses
	 * sources that hit an auth failure and reloads their blanked tiles.
	 */
	updateWMSLayerTokens(): void {
		for (const layer of this.wmsLayers) {
			const source = layer.getSource() as TileWMS;
			if (!source) continue;

			const resetAuthFailure = source.get('resetAuthFailure');
			if (typeof resetAuthFailure !== 'function') continue;

			if (resetAuthFailure()) {
				source.refresh();
			}
		}
	}

	/** Removes all layers from the map, disposes tile sources, and stops the WMS heartbeat. */
	cleanup(): void {
		stopWMSHeartbeat();

		if (this._visibilityHandler) {
			document.removeEventListener('visibilitychange', this._visibilityHandler);
			this._visibilityHandler = null;
		}

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
