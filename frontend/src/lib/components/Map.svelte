<script>
	import { onMount, createEventDispatcher, onDestroy } from 'svelte';
	import { browser } from '$app/environment'; // Import browser check
	import { mapCenter, mapZoom } from '$lib/stores/mapStore';

	// Props
	let {
		layers = [],
		viewOptions = {},
		mapOptions = {},
		className = '' // add your own CSS class(es)
	} = $props();

	let container; // div that will host the map
	let map = $state(); // ol/Map instance
	const dispatch = createEventDispatcher();

	// Get initial values from the store for SSR safety
	// We use $state for map so direct $store usage might cause issues
	let initialCenter = $state(browser ? $mapCenter : [0, 0]);
	let initialZoom = $state(browser ? $mapZoom : 2);

	onMount(async () => {
		// dynamically import OL modules to avoid SSR breakage
		const [
			{ default: OlMap },
			{ default: OlView },
			{ defaults: defaultControls } // defaults is a named export
		] = await Promise.all([
			import('ol/Map'),
			import('ol/View'),
			import('ol/control')
		]);

		let initialLayers = layers;
		// if no layers passed in, give a default OSM base-layer
		if (!initialLayers.length) {
			// Import Tile and OSM here as they are also default exports
			const [{ default: TileLayer }, { default: OSMSource }] = await Promise.all([
				import('ol/layer/Tile'),
				import('ol/source/OSM')
			]);
			// Use a local variable, don't mutate the prop
			initialLayers = [new TileLayer({ source: new OSMSource() })];
		}

		map = new OlMap({
			target: container,
			layers: initialLayers,
			view: new OlView({ center: initialCenter, zoom: initialZoom, ...viewOptions }),
			controls: defaultControls().extend(mapOptions.controls || []),
			...mapOptions
		});

		// let parent know map is ready
		dispatch('ready', { map });

		// forward any OL events you care about
		map.on('moveend', () => {
			const v = map.getView();
			const newCenter = v.getCenter();
			const newZoom = v.getZoom() ?? 2; // Ensure zoom is never null/undefined

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

</script>

<div class="map {className} " bind:this={container}>
</div>

<style>
	.map {
		width: 100%;
		height: 100%;
	}
</style>
