<script>
	import { onMount, createEventDispatcher, onDestroy } from 'svelte';
	import { browser } from '$app/environment'; // Import browser check
	import { mapCenter, mapZoom } from '$lib/stores/store';
	import OpacitySlider from './OpacitySlider.svelte'; // Import the new OpacitySlider
	import LayerVisibilityTree from './LayerVisibilityTree.svelte'; // Import the new LayerVisibilityTree

	// Props
	let {
		layers = [],
		viewOptions = {},
		mapOptions = {},
		className = '',
		showOpacitySlider = true,
		showLayerVisibilityTree = true,
		onLayerVisibilityChanged = () => {}
	} = $props();

	let container; // div that will host the map
	let map = $state(); // ol/Map instance
	let osmLayer = $state(); // Reference to the OSM layer for opacity control
	const dispatch = createEventDispatcher();

	// Get initial values from the store for SSR safety
	// We use $state for map so direct $store usage might cause issues
	let initialCenter = $state(browser ? $mapCenter : [0, 0]);
	let initialZoom = $state(browser ? $mapZoom : 2);

	// Reactive state for the slider's current opacity value
	let currentLayerOpacity = $state(1); // Default to fully opaque

	// Opacity Slider configuration
	const opacitySliderConfig = {
		minOpacity: 0,
		maxOpacity: 1,
		stepOpacity: 0.01
	};

	onMount(async () => {
		// dynamically import OL modules to avoid SSR breakage
		const [
			{ default: OlMap },
			{ default: OlView },
			{ defaults: defaultControls } // defaults is a named export
		] = await Promise.all([import('ol/Map'), import('ol/View'), import('ol/control')]);

		// Import Tile and OSM here as they are also default exports
		const [{ default: TileLayer }, { default: OSMSource }] = await Promise.all([
			import('ol/layer/Tile'),
			import('ol/source/OSM')
		]);

		// Create the default OSM base layer
		osmLayer = new TileLayer({ source: new OSMSource(), opacity: currentLayerOpacity });

		// Combine the default OSM layer with any layers passed in via props
		// Prepend the OSM layer so it's the base layer
		const mapLayers = [osmLayer, ...layers];

		map = new OlMap({
			target: container,
			layers: mapLayers, // Use the combined layers array
			view: new OlView({
				center: initialCenter,
				zoom: initialZoom, // Use initialZoom for map setup
				...viewOptions
			}),
			controls: defaultControls().extend(mapOptions.controls || []),
			...mapOptions
		});

		// Initialize currentLayerOpacity from the layer itself, though set above.
		// This is more for consistency if layer had a different initial opacity.
		currentLayerOpacity = osmLayer.getOpacity();

		// let parent know map is ready
		dispatch('ready', { map });

		map.on('moveend', () => {
			const v = map.getView();
			const newCenter = v.getCenter();
			const newZoom = v.getZoom() ?? 2;

			if (browser) {
				// Update the store
				$mapCenter = newCenter;
				$mapZoom = newZoom;
			}
			// Also dispatch event for potential parent listeners
			dispatch('moveend', { center: newCenter, zoom: newZoom });
		});
		map.on('click', (e) => dispatch('click', e));

		return () => {
			if (map) {
				map.setTarget(undefined); // Use undefined as per OL docs recommendation
				map = undefined; // Clear the state
			}
		};
	});

	// Cleanup function
	onDestroy(() => {
		const currentMap = map;
		if (currentMap) {
			currentMap.setTarget(undefined);
			map = undefined; // Ensure map instance is cleared
		}
	});

	function handleOpacitySliderChange(newOpacity) {
		currentLayerOpacity = newOpacity;
		if (osmLayer) {
			// Check if osmLayer is initialized
			osmLayer.setOpacity(newOpacity);
		}
	}

	function handleLayerVisibilityChange(layerInfo) {
		onLayerVisibilityChanged(layerInfo);
	}
</script>

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
	{#if showLayerVisibilityTree && map}
		<div class="absolute top-5 right-5 z-10">
			<LayerVisibilityTree
				{layers}
				{osmLayer}
				onLayerVisibilityChanged={handleLayerVisibilityChange}
			/>
		</div>
	{/if}
</div>

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
</style>
