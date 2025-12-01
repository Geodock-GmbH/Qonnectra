<script>
	import { onMount } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import { MapInteractionManager } from '$lib/classes/MapInteractionManager.svelte.js';
	import { MapPopupManager } from '$lib/classes/MapPopupManager.svelte.js';
	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte.js';
	import { NodeAssignmentManager } from '$lib/classes/NodeAssignmentManager.svelte.js';
	import Drawer from '$lib/components/Drawer.svelte';
	import Map from '$lib/components/Map.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { nodeTypeStyles, selectedProject, trenchColor, trenchColorSelected } from '$lib/stores/store';

	import HouseConnectionDrawerTabs from './HouseConnectionDrawerTabs.svelte';

	import 'ol/ol.css';

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// Initialize managers
	const mapState = new MapState(
		$selectedProject,
		$trenchColor,
		$trenchColorSelected,
		{
			trench: true,
			address: true,
			node: true
		},
		{
			trench: { enabled: true },
			address: { enabled: true },
			node: { enabled: true }
		}
	);

	const selectionManager = new MapSelectionManager();
	const popupManager = new MapPopupManager(data.alias);
	const interactionManager = new MapInteractionManager(
		selectionManager,
		popupManager,
		drawerStore,
		HouseConnectionDrawerTabs,
		data.alias,
		{
			trench: true,
			address: false,
			node: false
		}
	);

	// Initialize NodeAssignmentManager and pass through drawer props
	const nodeAssignmentManager = new NodeAssignmentManager(interactionManager);
	interactionManager.setAdditionalDrawerProps({ nodeAssignmentManager });

	const layersInitialized = mapState.initializeLayers();

	// Refresh tile sources when they exist
	$effect(() => {
		mapState.refreshTileSources();
	});

	// Update node layer style when nodeTypeStyles changes
	$effect(() => {
		const styles = $nodeTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateNodeLayerStyle(styles);
		}
	});

	/**
	 * Handler for the map ready event
	 * Initializes all map interactions and overlays
	 */
	function handleMapReady(event) {
		const olMapInstance = event.detail.map;

		// Initialize selection layers
		mapState.initializeSelectionLayers(olMapInstance, () => selectionManager.getSelectionStore());

		// Register selection layers with selection manager
		const selectionLayers = mapState.getSelectionLayers();
		selectionLayers.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		// Initialize popup
		popupManager.initialize(olMapInstance);

		// Initialize interaction handlers
		const layers = mapState.getLayerReferences();
		interactionManager.initialize(olMapInstance, layers);
	}

	// Cleanup on destroy
	onMount(() => {
		return () => {
			mapState.cleanup();
			selectionManager.cleanup();
			popupManager.cleanup(mapState.olMap);
			interactionManager.cleanup();
			nodeAssignmentManager.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_house_connections()}</title>
</svelte:head>

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 h-full">
		{#if layersInitialized}
			<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full">
				<Map
					className="rounded-lg overflow-hidden"
					showSearchPanel={true}
					layers={mapState.getLayers()}
					nodeTypes={data.nodeTypes ?? []}
					on:ready={handleMapReady}
				/>
				<div id="popup" class="ol-popup bg-primary-500 rounded-lg border-2 border-primary-600">
					<!-- svelte-ignore a11y_invalid_attribute -->
					<a href="#" id="popup-closer" class="ol-popup-closer" aria-label="Close popup"></a>
					<div id="popup-content"></div>
				</div>
			</div>
		{:else}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{/if}
	</div>

	<Drawer />
</div>

<style>
	.ol-popup {
		position: absolute;
		padding: 8px;
		transform: translate(-50%, -100%);
		pointer-events: auto;
		min-width: 180px;
		z-index: 10;
	}
	.ol-popup-closer {
		position: absolute;
		top: 4px;
		right: 8px;
		text-decoration: none;
		font-weight: bold;
		cursor: pointer;
		color: #fff;
	}

	#popup-content {
		padding: 5px;
		color: #fff;
		max-height: 200px;
		overflow-y: auto;
	}
</style>
