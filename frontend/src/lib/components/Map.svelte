<script lang="ts">
	import type { SearchFeaturePayload } from '$lib/map/searchUtils';
	import type { MapView } from '$lib/map/viewHash';
	import type { AreaType, ConstructionType, NodeType, Surface } from '$lib/types/mapLayers';
	import type BaseLayer from 'ol/layer/Base';
	import type TileLayer from 'ol/layer/Tile';
	import type OlMap from 'ol/Map';
	import type { MapOptions } from 'ol/Map';
	import type MapBrowserEvent from 'ol/MapBrowserEvent';
	import type { ViewOptions } from 'ol/View';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { IconSearch, IconX } from '@tabler/icons-svelte';
	import { env } from '$env/dynamic/public';

	import { MapMeasureManager } from '$lib/classes/MapMeasureManager.svelte.js';
	import { zoomToExtent } from '$lib/map/searchUtils';
	import { resolveInitialView, writeStoredView } from '$lib/map/storedView';
	import { tileLoadingManager } from '$lib/map/tileLoadingManager.js';
	import { parseViewHash, sameView, withViewHash } from '$lib/map/viewHash';
	import { getWorkerPool } from '$lib/map/workerPool';
	import {
		basemapTheme,
		layerOpacity,
		layerVisibilityConfig,
		tileServerAvailable,
		wmsSourcesData
	} from '$lib/stores/store';
	import { createZoomToLayerExtentHandler } from '$lib/utils/zoomToLayerExtent';
	import { getLayerExtent } from '$lib/remote/map/layers.remote';

	import LayerVisibilityTree from './LayerVisibilityTree.svelte';
	import MapContextMenu from './MapContextMenu.svelte';
	import OpacitySlider from './OpacitySlider.svelte';
	import SearchPanel from './SearchPanel.svelte';

	interface LayerVisibilityInfo {
		/** The layer identifier */
		layerId: string;
		/** Whether the layer is visible */
		visible: boolean;
		/** Layer reference */
		layer: BaseLayer | null;
	}

	interface NodeTypeInfo {
		/** The node type identifier */
		nodeType: string;
		/** Whether the node type is visible */
		visible: boolean;
	}

	interface TrenchTypeInfo {
		/** The trench type identifier */
		trenchType: string;
		/** Whether the trench type is visible */
		visible: boolean;
	}

	interface LabelInfo {
		/** The layer identifier */
		layerId: string;
		/** The label type key */
		labelType: string;
		/** Whether labels are enabled */
		enabled: boolean;
	}

	type MapVariant = 'fullscreen' | 'compact';

	let isMobileSearchOpen = $state(false);

	const TILE_SERVER_URL: string = env.PUBLIC_TILE_SERVER_URL || '';

	interface Props {
		layers?: BaseLayer[];
		viewOptions?: Partial<ViewOptions>;
		mapOptions?: Partial<MapOptions>;
		className?: string;
		showOpacitySlider?: boolean;
		showLayerVisibilityTree?: boolean;
		showSearchPanel?: boolean;
		showContextMenu?: boolean;
		contextMenuActions?: { measureDistance?: boolean; measureArea?: boolean };
		onLayerVisibilityChanged?: (info: LayerVisibilityInfo) => void;
		onNodeTypeVisibilityChanged?: (info: NodeTypeInfo) => void;
		onTrenchTypeVisibilityChanged?: (info: TrenchTypeInfo) => void;
		onLabelVisibilityChanged?: (info: LabelInfo) => void;
		onFeatureSelect?: (feature: SearchFeaturePayload) => void;
		onSearchError?: (error: Error | string) => void;
		searchPanelProps?: Record<string, unknown>;
		nodeTypes?: NodeType[];
		surfaces?: Surface[];
		constructionTypes?: ConstructionType[];
		areaTypes?: AreaType[];
		projectId?: string;
		/**
		 * Keeps the view in the URL hash (`#map=zoom/x/y`): the hash wins on
		 * load and follows every move. Off for embedded maps whose view comes
		 * from their content.
		 */
		viewInUrl?: boolean;
		variant?: MapVariant;
		onready?: (info: { map: OlMap; usingFallbackOSM: boolean }) => void;
		onmoveend?: (info: { center: number[] | undefined; zoom: number }) => void;
		onclick?: (e: MapBrowserEvent<PointerEvent>) => void;
	}

	let {
		layers = [],
		viewOptions = {},
		mapOptions = {},
		className = '',
		showOpacitySlider = true,
		showLayerVisibilityTree = true,
		showSearchPanel = true,
		showContextMenu = true,
		contextMenuActions = { measureDistance: true, measureArea: true },
		onLayerVisibilityChanged = () => {},
		onNodeTypeVisibilityChanged = () => {},
		onTrenchTypeVisibilityChanged = () => {},
		onLabelVisibilityChanged = () => {},
		onFeatureSelect = () => {},
		onSearchError = () => {},
		searchPanelProps = {},
		nodeTypes = [],
		surfaces = [],
		constructionTypes = [],
		areaTypes = [],
		projectId = '',
		viewInUrl = false,
		variant = 'fullscreen', // 'fullscreen' | 'compact'
		onready = () => {},
		onmoveend = () => {},
		onclick = () => {}
	}: Props = $props();

	let searchPanelRef = $state();
	// svelte-ignore state_referenced_locally
	const measureManager = showContextMenu ? new MapMeasureManager() : null;

	let container = $state<HTMLDivElement | undefined>();
	let map = $state<OlMap | undefined>();
	let osmLayer = $state<TileLayer | undefined>();
	let usingFallbackOSM = $state(false);

	/** The view a map shows before anything else is known. */
	const DEFAULT_VIEW: MapView = { zoom: 2, center: [0, 0] };

	/** Delay before a move is written to the URL, so a pan is one write. */
	const HASH_WRITE_DELAY_MS = 300;

	let hashWriteTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * The current view of the map, rounded like the hash.
	 * @returns The view, or null while the map has none.
	 */
	function currentView(): MapView | null {
		const view = map?.getView();
		const center = view?.getCenter();
		const zoom = view?.getZoom();
		if (!center || zoom === undefined) return null;
		return { zoom, center: [center[0], center[1]] };
	}

	/**
	 * Writes the current view into the URL hash without a navigation: no
	 * history entry, no `load`, no progress bar.
	 */
	function writeViewHash() {
		const view = currentView();
		if (!view) return;
		const url = new URL(page.url);
		url.hash = withViewHash(url.hash, view);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current, already-resolved URL with only its hash changed
		replaceState(url, page.state);
	}

	/**
	 * Moves the map to the view the URL now carries, when the user edited
	 * the hash or stepped through history. A hash the map wrote itself is
	 * the current view and moves nothing.
	 */
	function followViewHash() {
		if (!viewInUrl || !map) return;
		const target = parseViewHash(location.hash);
		const current = currentView();
		if (!target || !current || sameView(target, current)) return;
		map.getView().animate({ center: target.center, zoom: target.zoom, duration: 300 });
	}

	/**
	 * Fits the map to the project's trench extent, the view of a project
	 * never visited in this browser. An empty project keeps the defaults.
	 * @param mapInstance - The map to fit.
	 */
	async function fitProjectExtent(mapInstance: OlMap) {
		try {
			const { extent } = await getLayerExtent({ layerType: 'trench', projectId });
			if (extent && map === mapInstance) zoomToExtent(mapInstance, extent, { duration: 0 });
		} catch {
			// No extent to fit; the defaults stay.
		}
	}

	let currentLayerOpacity = $state(browser ? $layerOpacity : 1);

	const opacitySliderConfig = {
		minOpacity: 0,
		maxOpacity: 1,
		stepOpacity: 0.01
	};

	/**
	 * Checks if the tile server is available by sending a health check request.
	 * @returns True if the tile server responds successfully within timeout
	 */
	async function checkTileServerHealth() {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000);

			const response = await fetch(`${TILE_SERVER_URL}/health`, {
				method: 'HEAD',
				signal: controller.signal
			});

			clearTimeout(timeoutId);
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Applies a vector tile style from the tile server to the map.
	 * Falls back to OSM raster tiles if the style cannot be applied.
	 * @param mapInstance - The OpenLayers map instance
	 * @param theme - The basemap theme to apply
	 */
	async function applyVectorTileStyle(mapInstance: OlMap, theme: 'light' | 'dark') {
		if (!TILE_SERVER_URL) {
			await setupFallbackOSM(mapInstance);
			return;
		}

		try {
			const { apply } = await import('ol-mapbox-style');
			const styleUrl = `${TILE_SERVER_URL}/styles/${theme}/style.json`;

			const layersToRemove: BaseLayer[] = [];
			mapInstance.getLayers().forEach((layer) => {
				if (layer.get('isBaseLayer')) {
					layersToRemove.push(layer);
				}
			});
			layersToRemove.forEach((layer) => mapInstance.removeLayer(layer));

			await apply(mapInstance, styleUrl);

			const baseLayers: BaseLayer[] = [];
			const otherLayers: BaseLayer[] = [];
			mapInstance.getLayers().forEach((layer) => {
				if (layer.get('isSelectionLayer') || layer.get('isHighlightLayer')) {
					otherLayers.push(layer);
				} else if (!layer.get('layerId') && !layer.get('isBaseLayer')) {
					layer.set('isBaseLayer', true);
					layer.setOpacity(currentLayerOpacity);
					baseLayers.push(layer);
				} else if (layer.get('isBaseLayer')) {
					baseLayers.push(layer);
				} else {
					otherLayers.push(layer);
				}
			});

			const layerCollection = mapInstance.getLayers();
			layerCollection.clear();
			baseLayers.forEach((layer) => layerCollection.push(layer));
			otherLayers.forEach((layer) => layerCollection.push(layer));

			const storedVisible = get(layerVisibilityConfig)['osm-base-layer'] ?? true;
			baseLayers.forEach((layer) => {
				layer.setVisible(storedVisible);
			});

			usingFallbackOSM = false;
			$tileServerAvailable = true;
		} catch (error) {
			console.warn('Failed to apply vector tile style, falling back to OSM:', error);
			await setupFallbackOSM(mapInstance);
		}
	}

	/**
	 * Sets up fallback OpenStreetMap raster tiles when vector tile server is unavailable.
	 * @param mapInstance - The OpenLayers map instance
	 */
	async function setupFallbackOSM(mapInstance: OlMap) {
		const [{ default: TileLayer }, { default: OSMSource }] = await Promise.all([
			import('ol/layer/Tile'),
			import('ol/source/OSM')
		]);

		const layersToRemove: BaseLayer[] = [];
		mapInstance.getLayers().forEach((layer) => {
			if (layer.get('isBaseLayer')) {
				layersToRemove.push(layer);
			}
		});
		layersToRemove.forEach((layer) => mapInstance.removeLayer(layer));

		const storedVisible = get(layerVisibilityConfig)['osm-base-layer'] ?? true;
		osmLayer = new TileLayer({
			source: new OSMSource(),
			opacity: currentLayerOpacity,
			visible: storedVisible
		});
		osmLayer.set('isBaseLayer', true);
		mapInstance.getLayers().insertAt(0, osmLayer);

		usingFallbackOSM = true;
		$tileServerAvailable = false;
	}

	onMount(async () => {
		tileLoadingManager.resume();

		const [{ default: OlMap }, { default: OlView }, { defaults: defaultControls }] =
			await Promise.all([import('ol/Map'), import('ol/View'), import('ol/control')]);

		const initialOpacity = browser ? $layerOpacity : 1;
		currentLayerOpacity = initialOpacity;

		const controls = defaultControls({
			zoom: false
		});

		// Precedence: the URL hash, the project's remembered view, the project
		// extent (fitted once the map exists), the defaults.
		const initialView = resolveInitialView({
			hashView: viewInUrl ? parseViewHash(page.url.hash) : null,
			projectId
		});

		map = new OlMap({
			target: container,
			layers: [...layers],
			view: new OlView({
				center: (initialView ?? DEFAULT_VIEW).center,
				zoom: (initialView ?? DEFAULT_VIEW).zoom,
				...viewOptions
			}),
			controls: controls.extend(Array.isArray(mapOptions.controls) ? mapOptions.controls : []),
			...mapOptions
		});

		const tileServerIsAvailable = TILE_SERVER_URL ? await checkTileServerHealth() : false;

		if (tileServerIsAvailable) {
			const theme = browser ? $basemapTheme : 'light';
			await applyVectorTileStyle(map, theme);
		} else {
			await setupFallbackOSM(map);
		}

		if (measureManager) {
			measureManager.initialize(map);
		}

		if (!initialView && projectId && !viewOptions.center) void fitProjectExtent(map);

		onready({ map, usingFallbackOSM });

		map.on('moveend', () => {
			if (!map) return;
			const view = currentView();
			if (view) {
				writeStoredView(projectId, view);
				if (viewInUrl) {
					clearTimeout(hashWriteTimer);
					hashWriteTimer = setTimeout(writeViewHash, HASH_WRITE_DELAY_MS);
				}
			}

			onmoveend({ center: view?.center, zoom: view?.zoom ?? DEFAULT_VIEW.zoom });
		});
		map.getViewport().style.cursor = 'default';
		map.on('click', (e) => onclick(e as MapBrowserEvent<PointerEvent>));
	});

	$effect(() => {
		if (map && browser && !usingFallbackOSM && TILE_SERVER_URL) {
			const theme = $basemapTheme;
			applyVectorTileStyle(map, theme);
		}
	});

	onDestroy(() => {
		clearTimeout(hashWriteTimer);
		tileLoadingManager.cancelAllRequests();
		getWorkerPool().cancelAllRequests();

		if (measureManager) {
			measureManager.cleanup();
		}

		const currentMap = map;
		if (currentMap) {
			currentMap.setTarget(undefined);
			map = undefined;
		}
	});

	/**
	 * Handles base layer opacity changes from the slider.
	 * @param newOpacity - Opacity value between 0 and 1
	 */
	function handleOpacitySliderChange(newOpacity: number) {
		currentLayerOpacity = newOpacity;
		if (browser) {
			$layerOpacity = newOpacity;
		}

		if (map) {
			map.getLayers().forEach((layer) => {
				if (layer.get('isBaseLayer')) {
					layer.setOpacity(newOpacity);
				}
			});
		}

		if (osmLayer) {
			osmLayer.setOpacity(newOpacity);
		}
	}

	/**
	 * Handles layer visibility toggle from the layer tree.
	 * @param layerInfo - Layer visibility change info
	 */
	function handleLayerVisibilityChange(layerInfo: LayerVisibilityInfo) {
		if (layerInfo.layerId === 'osm-base-layer' && !layerInfo.layer && map) {
			map.getLayers().forEach((layer) => {
				if (layer.get('isBaseLayer')) {
					layer.setVisible(layerInfo.visible);
				}
			});
		}
		onLayerVisibilityChanged(layerInfo);
	}

	/**
	 * Handles node type visibility toggle from the layer tree.
	 * @param nodeTypeInfo - Node type visibility change info
	 */
	function handleNodeTypeVisibilityChange(nodeTypeInfo: NodeTypeInfo) {
		onNodeTypeVisibilityChanged(nodeTypeInfo);
	}

	/**
	 * Handles trench type visibility toggle from the layer tree.
	 * @param trenchTypeInfo - Trench type visibility change info
	 */
	function handleTrenchTypeVisibilityChange(trenchTypeInfo: TrenchTypeInfo) {
		onTrenchTypeVisibilityChanged(trenchTypeInfo);
	}

	/**
	 * Handles WMS layer visibility toggle from the layer tree.
	 * @param layerId - The WMS layer identifier
	 * @param visible - Whether the layer should be visible
	 */
	function handleWMSLayerVisibilityChange(layerId: string, visible: boolean) {
		if (!map) return;
		map.getLayers().forEach((layer) => {
			if (layer.get('layerId') === layerId) {
				layer.setVisible(visible);
			}
		});
	}

	/**
	 * Handles label visibility toggle from the layer tree.
	 * @param labelInfo - Label visibility change info
	 */
	function handleLabelVisibilityChange(labelInfo: LabelInfo) {
		onLabelVisibilityChanged(labelInfo);
	}

	/**
	 * Handles feature selection from the search panel.
	 * @param feature - The selected feature
	 */
	function handleFeatureSelect(feature: SearchFeaturePayload) {
		onFeatureSelect(feature);
	}

	/**
	 * Handles search errors from the search panel.
	 * @param error - The error that occurred
	 */
	function handleSearchError(error: unknown) {
		onSearchError(error instanceof Error ? error : String(error));
	}

	const handleZoomToExtent = createZoomToLayerExtentHandler(
		() => map,
		() => projectId
	);

	/**
	 * Gets the reference to the search panel component.
	 * @returns The search panel component instance
	 */
	export function getSearchPanelRef() {
		return searchPanelRef;
	}

	/**
	 * Gets the reference to the measure manager instance.
	 */
	export function getMeasureManager(): MapMeasureManager | null {
		return measureManager;
	}
</script>

<svelte:window onhashchange={followViewHash} onpopstate={followViewHash} />

<!-- Map: Compact variant -->
{#if variant === 'compact'}
	<div class="map-container-compact {className}">
		<!-- Map: Controls wrapper - compact variant -->
		<div class="map-controls-compact">
			{#if showSearchPanel && map}
				<SearchPanel
					olMapInstance={map}
					{projectId}
					onFeatureSelect={handleFeatureSelect}
					onSearchError={handleSearchError}
					{...searchPanelProps}
					bind:this={searchPanelRef}
				/>
			{/if}
			{#if showLayerVisibilityTree && map}
				<LayerVisibilityTree
					{layers}
					{osmLayer}
					{nodeTypes}
					{surfaces}
					{constructionTypes}
					{areaTypes}
					{usingFallbackOSM}
					{projectId}
					wmsSources={$wmsSourcesData.sources}
					onLayerVisibilityChanged={handleLayerVisibilityChange}
					onNodeTypeVisibilityChanged={handleNodeTypeVisibilityChange}
					onTrenchTypeVisibilityChanged={handleTrenchTypeVisibilityChange}
					onLabelVisibilityChanged={handleLabelVisibilityChange}
					onZoomToExtent={handleZoomToExtent}
					onWMSLayerVisibilityChanged={handleWMSLayerVisibilityChange}
				/>
			{/if}
			{#if showOpacitySlider && map}
				<div class="opacity-slider-compact">
					<OpacitySlider
						minOpacity={opacitySliderConfig.minOpacity}
						maxOpacity={opacitySliderConfig.maxOpacity}
						stepOpacity={opacitySliderConfig.stepOpacity}
						opacity={currentLayerOpacity}
						onChange={handleOpacitySliderChange}
					/>
				</div>
			{/if}
		</div>
		<!-- Map: Map canvas - compact variant -->
		{#if showContextMenu && measureManager}
			<MapContextMenu {measureManager} actions={contextMenuActions}>
				<div class="map" bind:this={container}></div>
			</MapContextMenu>
		{:else}
			<div class="map" bind:this={container}></div>
		{/if}
	</div>
	<!-- Map: Fullscreen variant -->
{:else}
	<div class="map-container {className}">
		<!-- Map: Map canvas - fullscreen variant -->
		{#if showContextMenu && measureManager}
			<MapContextMenu {measureManager} actions={contextMenuActions}>
				<div class="map" bind:this={container}></div>
			</MapContextMenu>
		{:else}
			<div class="map" bind:this={container}></div>
		{/if}

		<!-- Map: Opacity slider - fullscreen variant (desktop only, mobile is in layer sheet) -->
		{#if showOpacitySlider && map}
			<div
				class="hidden sm:block absolute sm:top-auto sm:right-auto sm:left-4 sm:bottom-5 z-10 sm:max-w-70"
			>
				<OpacitySlider
					minOpacity={opacitySliderConfig.minOpacity}
					maxOpacity={opacitySliderConfig.maxOpacity}
					stepOpacity={opacitySliderConfig.stepOpacity}
					opacity={currentLayerOpacity}
					onChange={handleOpacitySliderChange}
				/>
			</div>
		{/if}

		<!-- Map: Search panel - fullscreen variant (desktop) -->
		{#if showSearchPanel && map}
			<div class="hidden sm:block absolute sm:top-4 sm:left-4 sm:right-auto z-10 sm:max-w-md">
				<SearchPanel
					olMapInstance={map}
					{projectId}
					onFeatureSelect={handleFeatureSelect}
					onSearchError={handleSearchError}
					{...searchPanelProps}
					bind:this={searchPanelRef}
				/>
			</div>
		{/if}

		<!-- Map: Search panel - fullscreen variant (mobile) -->
		{#if showSearchPanel && map}
			<div class="sm:hidden">
				{#if isMobileSearchOpen}
					<div class="absolute inset-x-3 top-3 z-20">
						<div class="relative">
							<SearchPanel
								olMapInstance={map}
								{projectId}
								onFeatureSelect={(detail) => {
									handleFeatureSelect(detail);
									isMobileSearchOpen = false;
								}}
								onSearchError={handleSearchError}
								{...searchPanelProps}
								bind:this={searchPanelRef}
							/>
							<button
								class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-surface-200-800 flex items-center justify-center shadow-md z-30"
								onclick={() => (isMobileSearchOpen = false)}
							>
								<IconX size={16} />
							</button>
						</div>
					</div>
				{:else}
					<button
						class="absolute top-3 left-3 z-10 w-12 h-12 rounded-full bg-surface-50-950 border border-surface-200-800 shadow-md flex items-center justify-center active:scale-95 transition-transform"
						onclick={() => (isMobileSearchOpen = true)}
					>
						<IconSearch size={20} class="text-surface-600-400" />
					</button>
				{/if}
			</div>
		{/if}

		<!-- Map: Layer visibility tree - fullscreen variant -->
		{#if showLayerVisibilityTree && map}
			<div class="sm:absolute sm:top-4 sm:right-4 z-10">
				<LayerVisibilityTree
					{layers}
					{osmLayer}
					{nodeTypes}
					{surfaces}
					{constructionTypes}
					{areaTypes}
					{usingFallbackOSM}
					{projectId}
					wmsSources={$wmsSourcesData.sources}
					onLayerVisibilityChanged={handleLayerVisibilityChange}
					onNodeTypeVisibilityChanged={handleNodeTypeVisibilityChange}
					onTrenchTypeVisibilityChanged={handleTrenchTypeVisibilityChange}
					onLabelVisibilityChanged={handleLabelVisibilityChange}
					onZoomToExtent={handleZoomToExtent}
					onWMSLayerVisibilityChanged={handleWMSLayerVisibilityChange}
					mobileOpacitySlider={showOpacitySlider
						? {
								minOpacity: opacitySliderConfig.minOpacity,
								maxOpacity: opacitySliderConfig.maxOpacity,
								stepOpacity: opacitySliderConfig.stepOpacity,
								opacity: currentLayerOpacity,
								onChange: handleOpacitySliderChange
							}
						: null}
				/>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Map container - fullscreen variant */
	.map-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	/* Map element */
	.map {
		width: 100%;
		height: 100%;
	}

	/* Map container - compact variant */
	.map-container-compact {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	/* Map controls wrapper - compact variant */
	.map-controls-compact {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	/* Opacity slider wrapper - compact variant */
	.opacity-slider-compact {
		width: 100%;
	}
</style>
