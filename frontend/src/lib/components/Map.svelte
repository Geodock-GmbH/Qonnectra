<script>
	/**
	 * @typedef {Object} LayerVisibilityInfo
	 * @property {string} layerId - The layer identifier
	 * @property {boolean} visible - Whether the layer is visible
	 * @property {import('ol/layer/Layer').default} [layer] - Optional layer reference
	 */

	/**
	 * @typedef {Object} NodeTypeInfo
	 * @property {string} nodeType - The node type identifier
	 * @property {boolean} visible - Whether the node type is visible
	 */

	/**
	 * @typedef {Object} TrenchTypeInfo
	 * @property {string} trenchType - The trench type identifier
	 * @property {boolean} visible - Whether the trench type is visible
	 */

	/**
	 * @typedef {Object} LabelInfo
	 * @property {string} layerId - The layer identifier
	 * @property {boolean} labelsVisible - Whether labels are visible
	 */

	/**
	 * @typedef {'fullscreen' | 'compact'} MapVariant
	 */

	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';

	import { tileLoadingManager } from '$lib/map/tileLoadingManager.js';
	import { getWorkerPool } from '$lib/map/workerPool.js';
	import {
		basemapTheme,
		layerOpacity,
		layerVisibilityConfig,
		mapCenter,
		mapZoom,
		selectedProject,
		tileServerAvailable,
		wmsSourcesData
	} from '$lib/stores/store';
	import { createZoomToLayerExtentHandler } from '$lib/utils/zoomToLayerExtent';

	import LayerVisibilityTree from './LayerVisibilityTree.svelte';
	import OpacitySlider from './OpacitySlider.svelte';
	import SearchPanel from './SearchPanel.svelte';

	/** @type {string} */
	const TILE_SERVER_URL = env.PUBLIC_TILE_SERVER_URL || '';

	let {
		layers = [],
		viewOptions = {},
		mapOptions = {},
		className = '',
		showOpacitySlider = true,
		showLayerVisibilityTree = true,
		showSearchPanel = true,
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
		variant = 'fullscreen' // 'fullscreen' | 'compact'
	} = $props();

	let searchPanelRef = $state();

	let container = $state();
	let map = $state();
	let osmLayer = $state();
	let baseLayerGroup = $state();
	let usingFallbackOSM = $state(false);
	const dispatch = createEventDispatcher();

	let initialCenter = $state(browser ? $mapCenter : [0, 0]);
	let initialZoom = $state(browser ? $mapZoom : 2);

	let currentLayerOpacity = $state(browser ? $layerOpacity : 1);

	const opacitySliderConfig = {
		minOpacity: 0,
		maxOpacity: 1,
		stepOpacity: 0.01
	};

	/**
	 * Checks if the tile server is available by sending a health check request.
	 * @returns {Promise<boolean>} True if the tile server responds successfully within timeout
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
	 * @param {import('ol/Map').default} mapInstance - The OpenLayers map instance
	 * @param {'light' | 'dark'} theme - The basemap theme to apply
	 */
	async function applyVectorTileStyle(mapInstance, theme) {
		if (!TILE_SERVER_URL) {
			await setupFallbackOSM(mapInstance);
			return;
		}

		try {
			const { apply } = await import('ol-mapbox-style');
			const styleUrl = `${TILE_SERVER_URL}/styles/${theme}/style.json`;

			const layersToRemove = [];
			mapInstance.getLayers().forEach((layer) => {
				if (layer.get('isBaseLayer')) {
					layersToRemove.push(layer);
				}
			});
			layersToRemove.forEach((layer) => mapInstance.removeLayer(layer));

			await apply(mapInstance, styleUrl);

			const baseLayers = [];
			const otherLayers = [];
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
	 * @param {import('ol/Map').default} mapInstance - The OpenLayers map instance
	 */
	async function setupFallbackOSM(mapInstance) {
		const [{ default: TileLayer }, { default: OSMSource }] = await Promise.all([
			import('ol/layer/Tile'),
			import('ol/source/OSM')
		]);

		const layersToRemove = [];
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

		const [
			{ default: OlMap },
			{ default: OlView },
			{ defaults: defaultControls },
			{ default: Zoom }
		] = await Promise.all([
			import('ol/Map'),
			import('ol/View'),
			import('ol/control'),
			import('ol/control/Zoom')
		]);

		const initialOpacity = browser ? $layerOpacity : 1;
		currentLayerOpacity = initialOpacity;

		const controls = defaultControls({
			zoom: false
		});

		map = new OlMap({
			target: container,
			layers: [...layers],
			view: new OlView({
				center: initialCenter,
				zoom: initialZoom,
				...viewOptions
			}),
			controls: controls.extend(mapOptions.controls || []),
			...mapOptions
		});

		const tileServerIsAvailable = TILE_SERVER_URL ? await checkTileServerHealth() : false;

		if (tileServerIsAvailable) {
			const theme = browser ? $basemapTheme : 'light';
			await applyVectorTileStyle(map, theme);
		} else {
			await setupFallbackOSM(map);
		}

		dispatch('ready', { map, usingFallbackOSM });

		map.on('moveend', () => {
			const v = map.getView();
			const newCenter = v.getCenter();
			const newZoom = v.getZoom() ?? 2;

			if (browser) {
				$mapCenter = newCenter;
				$mapZoom = newZoom;
			}

			dispatch('moveend', { center: newCenter, zoom: newZoom });
		});
		map.on('click', (e) => dispatch('click', e));

		return () => {
			if (map) {
				map.setTarget(undefined);
				map = undefined;
			}
		};
	});

	$effect(() => {
		if (map && browser && !usingFallbackOSM && TILE_SERVER_URL) {
			const theme = $basemapTheme;
			applyVectorTileStyle(map, theme);
		}
	});

	onDestroy(() => {
		tileLoadingManager.cancelAllRequests();
		getWorkerPool().cancelAllRequests();

		const currentMap = map;
		if (currentMap) {
			currentMap.setTarget(undefined);
			map = undefined;
		}
	});

	/**
	 * Handles base layer opacity changes from the slider.
	 * @param {number} newOpacity - Opacity value between 0 and 1
	 */
	function handleOpacitySliderChange(newOpacity) {
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
	 * @param {LayerVisibilityInfo} layerInfo - Layer visibility change info
	 */
	function handleLayerVisibilityChange(layerInfo) {
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
	 * @param {NodeTypeInfo} nodeTypeInfo - Node type visibility change info
	 */
	function handleNodeTypeVisibilityChange(nodeTypeInfo) {
		onNodeTypeVisibilityChanged(nodeTypeInfo);
	}

	/**
	 * Handles trench type visibility toggle from the layer tree.
	 * @param {TrenchTypeInfo} trenchTypeInfo - Trench type visibility change info
	 */
	function handleTrenchTypeVisibilityChange(trenchTypeInfo) {
		onTrenchTypeVisibilityChanged(trenchTypeInfo);
	}

	/**
	 * Handles WMS layer visibility toggle from the layer tree.
	 * @param {string} layerId - The WMS layer identifier
	 * @param {boolean} visible - Whether the layer should be visible
	 */
	function handleWMSLayerVisibilityChange(layerId, visible) {
		if (!map) return;
		map.getLayers().forEach((layer) => {
			if (layer.get('layerId') === layerId) {
				layer.setVisible(visible);
			}
		});
	}

	/**
	 * Handles label visibility toggle from the layer tree.
	 * @param {LabelInfo} labelInfo - Label visibility change info
	 */
	function handleLabelVisibilityChange(labelInfo) {
		onLabelVisibilityChanged(labelInfo);
	}

	/**
	 * Handles feature selection from the search panel.
	 * @param {import('ol/Feature').default} feature - The selected feature
	 */
	function handleFeatureSelect(feature) {
		onFeatureSelect(feature);
	}

	/**
	 * Handles search errors from the search panel.
	 * @param {Error | string} error - The error that occurred
	 */
	function handleSearchError(error) {
		onSearchError(error);
	}

	const handleZoomToExtent = createZoomToLayerExtentHandler(
		() => map,
		() => $selectedProject
	);

	/**
	 * Gets the reference to the search panel component.
	 * @returns {typeof SearchPanel | undefined} The search panel component instance
	 */
	export function getSearchPanelRef() {
		return searchPanelRef;
	}
</script>

<!-- Map: Compact variant -->
{#if variant === 'compact'}
	<div class="map-container-compact {className}">
		<!-- Map: Controls wrapper - compact variant -->
		<div class="map-controls-compact">
			{#if showSearchPanel && map}
				<SearchPanel
					olMapInstance={map}
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
		<div class="map" bind:this={container}></div>
	</div>
	<!-- Map: Fullscreen variant -->
{:else}
	<div class="map-container {className}">
		<!-- Map: Map canvas - fullscreen variant -->
		<div class="map" bind:this={container}></div>

		<!-- Map: Opacity slider - fullscreen variant -->
		{#if showOpacitySlider && map}
			<div
				class="absolute top-20 left-3 right-3 sm:top-auto sm:right-auto sm:left-4 sm:bottom-5 z-10 sm:max-w-[280px]"
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

		<!-- Map: Search panel - fullscreen variant -->
		{#if showSearchPanel && map}
			<div class="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto z-10 sm:max-w-md">
				<SearchPanel
					olMapInstance={map}
					onFeatureSelect={handleFeatureSelect}
					onSearchError={handleSearchError}
					{...searchPanelProps}
					bind:this={searchPanelRef}
				/>
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
