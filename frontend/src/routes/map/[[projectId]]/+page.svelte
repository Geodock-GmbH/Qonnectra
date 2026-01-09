<script>
	import { onMount, setContext, untrack } from 'svelte';
	import { get } from 'svelte/store';

	import { m } from '$lib/paraglide/messages';

	import { MapInteractionManager } from '$lib/classes/MapInteractionManager.svelte.js';
	import { MapPopupManager } from '$lib/classes/MapPopupManager.svelte.js';
	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte.js';
	import Drawer from '$lib/components/Drawer.svelte';
	import Map from '$lib/components/Map.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import {
		addressStyle,
		areaTypeStyles,
		labelVisibilityConfig,
		nodeTypeStyles,
		selectedProject,
		trenchColor,
		trenchColorSelected,
		trenchConstructionTypeStyles,
		trenchStyleMode,
		trenchSurfaceStyles
	} from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import MapDrawerTabs from './MapDrawerTabs.svelte';

	import 'ol/ol.css';

	/** @type {import('./$types').PageData} */
	let { data } = $props();
	let mapRef = $state();
	let searchPanelRef = $state();

	// Initialize managers
	const mapState = new MapState($selectedProject, get(trenchColorSelected));
	const selectionManager = new MapSelectionManager();
	const popupManager = new MapPopupManager(data.alias);
	const interactionManager = new MapInteractionManager(
		selectionManager,
		popupManager,
		drawerStore,
		MapDrawerTabs,
		data.alias
	);

	setContext('mapManagers', {
		mapState,
		selectionManager,
		popupManager,
		interactionManager
	});

	// Initialize layers
	const layersInitialized = mapState.initializeLayers();

	// Reinitialize map layers when project changes
	$effect(() => {
		const currentProject = $selectedProject;
		// Only reinitialize if project actually changed and map is ready
		untrack(() => {
			if (mapState.olMap && currentProject !== mapState.selectedProject) {
				mapState.reinitializeForProject(currentProject);
				selectionManager.clearSelection();
			}
		});
	});

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

	// Update trench layer style when trench style settings change
	$effect(() => {
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		mapState.updateTrenchLayerStyle(mode, surfaceStyles, constructionTypeStyles, color);
	});

	// Update address layer style when address style settings change
	$effect(() => {
		const color = $addressStyle.color;
		const size = $addressStyle.size;
		mapState.updateAddressLayerStyle(color, size);
	});

	// Update area layer style when areaTypeStyles changes
	$effect(() => {
		const styles = $areaTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateAreaLayerStyle(styles);
		}
	});

	// Update label visibility when labelVisibilityConfig changes
	$effect(() => {
		const config = $labelVisibilityConfig;
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		const nodeStyles = $nodeTypeStyles;
		const areaStyles = $areaTypeStyles;

		// Update each layer type based on config
		if (config.trench !== undefined) {
			mapState.updateLabelVisibility('trench', config.trench, {
				mode,
				surfaceStyles,
				constructionTypeStyles,
				color
			});
		}
		if (config.address !== undefined) {
			mapState.updateLabelVisibility('address', config.address, {});
		}
		if (config.node !== undefined) {
			mapState.updateLabelVisibility('node', config.node, { nodeTypeStyles: nodeStyles });
		}
		if (config.area !== undefined) {
			mapState.updateLabelVisibility('area', config.area, { areaTypeStyles: areaStyles });
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
		interactionManager.initialize(olMapInstance, layers, searchPanelRef);
	}

	/**
	 * Update search panel reference when map component provides it
	 */
	$effect(() => {
		if (mapRef && mapRef.getSearchPanelRef) {
			searchPanelRef = mapRef.getSearchPanelRef();
			if (searchPanelRef) {
				interactionManager.setSearchPanelRef(searchPanelRef);
			}
		}
	});

	/**
	 * Cleanup on component destroy
	 */
	onMount(() => {
		return () => {
			mapState.cleanup();
			selectionManager.cleanup();
			popupManager.cleanup(mapState.olMap);
			interactionManager.cleanup();
		};
	});

	// Show error if data failed to load
	if (data.error) {
		globalToaster.error({
			title: m.title_error_loading_map_features(),
			description: data.error
		});
	}
</script>

<svelte:head>
	<title>{m.nav_map()}</title>
</svelte:head>

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 h-full">
		{#if data.error && !layersInitialized}
			<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
				<p>Error loading initial map data: {data.error}</p>
			</div>
		{:else if layersInitialized}
			<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full">
				<Map
					className="rounded-lg overflow-hidden"
					layers={mapState.getLayers()}
					nodeTypes={data.nodeTypes ?? []}
					surfaces={data.surfaces ?? []}
					constructionTypes={data.constructionTypes ?? []}
					on:ready={handleMapReady}
					searchPanelProps={{
						trenchColorSelected: $trenchColorSelected,
						alias: data.alias
					}}
					bind:this={mapRef}
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
