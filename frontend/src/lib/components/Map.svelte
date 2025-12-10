<script>
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';

	import { mapCenter, mapZoom } from '$lib/stores/store';

	import LayerVisibilityTree from './LayerVisibilityTree.svelte';
	import OpacitySlider from './OpacitySlider.svelte';
	import SearchPanel from './SearchPanel.svelte';

	// Props
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
		variant = 'fullscreen' // 'fullscreen' | 'compact'
	} = $props();

	let searchPanelRef = $state();

	let container = $state();
	let map = $state();
	let osmLayer = $state();
	const dispatch = createEventDispatcher();

	let initialCenter = $state(browser ? $mapCenter : [0, 0]);
	let initialZoom = $state(browser ? $mapZoom : 2);

	let currentLayerOpacity = $state(1);

	const opacitySliderConfig = {
		minOpacity: 0,
		maxOpacity: 1,
		stepOpacity: 0.01
	};

	onMount(async () => {
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

		const [{ default: TileLayer }, { default: OSMSource }] = await Promise.all([
			import('ol/layer/Tile'),
			import('ol/source/OSM')
		]);

		osmLayer = new TileLayer({ source: new OSMSource(), opacity: currentLayerOpacity });

		const mapLayers = [osmLayer, ...layers];

		// Create controls without zoom controls
		const controls = defaultControls({
			zoom: false
		});

		map = new OlMap({
			target: container,
			layers: mapLayers,
			view: new OlView({
				center: initialCenter,
				zoom: initialZoom,
				...viewOptions
			}),
			controls: controls.extend(mapOptions.controls || []),
			...mapOptions
		});

		currentLayerOpacity = osmLayer.getOpacity();

		dispatch('ready', { map });

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

	onDestroy(() => {
		const currentMap = map;
		if (currentMap) {
			currentMap.setTarget(undefined);
			map = undefined;
		}
	});

	function handleOpacitySliderChange(newOpacity) {
		currentLayerOpacity = newOpacity;
		if (osmLayer) {
			osmLayer.setOpacity(newOpacity);
		}
	}

	function handleLayerVisibilityChange(layerInfo) {
		onLayerVisibilityChanged(layerInfo);
	}

	function handleNodeTypeVisibilityChange(nodeTypeInfo) {
		onNodeTypeVisibilityChanged(nodeTypeInfo);
	}

	function handleTrenchTypeVisibilityChange(trenchTypeInfo) {
		onTrenchTypeVisibilityChanged(trenchTypeInfo);
	}

	function handleLabelVisibilityChange(labelInfo) {
		onLabelVisibilityChanged(labelInfo);
	}

	function handleFeatureSelect(feature) {
		onFeatureSelect(feature);
	}

	function handleSearchError(error) {
		onSearchError(error);
	}

	// Expose searchPanelRef to parent component
	export function getSearchPanelRef() {
		return searchPanelRef;
	}
</script>

{#if variant === 'compact'}
	<div class="map-container-compact {className}">
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
					onLayerVisibilityChanged={handleLayerVisibilityChange}
					onNodeTypeVisibilityChanged={handleNodeTypeVisibilityChange}
					onTrenchTypeVisibilityChanged={handleTrenchTypeVisibilityChange}
					onLabelVisibilityChanged={handleLabelVisibilityChange}
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
		<div class="map" bind:this={container}></div>
	</div>
{:else}
	<div class="map-container {className}">
		<div class="map" bind:this={container}></div>
		{#if showOpacitySlider && map}
			<div class="absolute bottom-5 left-5 z-10">
				<OpacitySlider
					minOpacity={opacitySliderConfig.minOpacity}
					maxOpacity={opacitySliderConfig.maxOpacity}
					stepOpacity={opacitySliderConfig.stepOpacity}
					opacity={currentLayerOpacity}
					onChange={handleOpacitySliderChange}
				/>
			</div>
		{/if}
		{#if showSearchPanel && map}
			<div class="absolute top-5 left-5 right-5 lg:right-auto z-9 lg:max-w-md">
				<SearchPanel
					olMapInstance={map}
					onFeatureSelect={handleFeatureSelect}
					onSearchError={handleSearchError}
					{...searchPanelProps}
					bind:this={searchPanelRef}
				/>
			</div>
		{/if}
		{#if showLayerVisibilityTree && map}
			<div class="absolute top-28 right-5 lg:top-5 z-9">
				<LayerVisibilityTree
					{layers}
					{osmLayer}
					{nodeTypes}
					{surfaces}
					{constructionTypes}
					onLayerVisibilityChanged={handleLayerVisibilityChange}
					onNodeTypeVisibilityChanged={handleNodeTypeVisibilityChange}
					onTrenchTypeVisibilityChanged={handleTrenchTypeVisibilityChange}
					onLabelVisibilityChanged={handleLabelVisibilityChange}
				/>
			</div>
		{/if}
	</div>
{/if}

<style>
	.map-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.map {
		width: 100%;
		height: 100%;
	}

	.map-container-compact {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		gap: 0.75rem;
	}

	.map-controls-compact {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.opacity-slider-compact {
		width: 100%;
	}
</style>
