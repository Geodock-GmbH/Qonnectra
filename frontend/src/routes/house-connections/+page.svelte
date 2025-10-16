<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { onMount } from 'svelte';

	// Components
	import Drawer from '$lib/components/Drawer.svelte';
	import Map from '$lib/components/Map.svelte';
	// Managers
	import { MapState } from '$lib/classes/MapState.svelte.js';

	// Stores
	import { selectedProject, trenchColor, trenchColorSelected } from '$lib/stores/store';

	// OpenLayers CSS
	import 'ol/ol.css';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	// Initialize map state to manage layers
	const mapState = new MapState($selectedProject, $trenchColor, $trenchColorSelected, {
		trench: true,
		address: false,
		node: false
	});

	// Initialize layers (trench, address, node)
	const layersInitialized = mapState.initializeLayers();

	// Cleanup on destroy
	onMount(() => {
		return () => {
			mapState.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_house_connections()}</title>
</svelte:head>

{#if layersInitialized}
	<Map showSearchPanel={false} layers={mapState.getLayers()} />
{:else}
	<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
		<p>Map tiles could not be loaded. Please check the connection or configuration.</p>
	</div>
{/if}

<Drawer />
