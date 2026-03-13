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
		globalMapView,
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
	import { startHeartbeat, stopHeartbeat } from '$lib/utils/tokenHeartbeat.svelte.js';

	import MapDrawerTabs from './MapDrawerTabs.svelte';

	import 'ol/ol.css';

	/** @type {{ data: Record<string, any> }} */
	let { data } = $props();
	let mapRef = $state();
	let searchPanelRef = $state();

	const mapState = new MapState(
		$selectedProject,
		get(trenchColorSelected),
		null,
		null,
		get(globalMapView)
	);
	const selectionManager = new MapSelectionManager();
	// svelte-ignore state_referenced_locally
	const popupManager = new MapPopupManager(data.alias);
	// svelte-ignore state_referenced_locally
	const interactionManager = new MapInteractionManager(
		selectionManager,
		popupManager,
		drawerStore,
		MapDrawerTabs,
		data.alias
	);

	// svelte-ignore state_referenced_locally
	interactionManager.setAdditionalDrawerProps({ projects: data.projects });

	setContext('mapManagers', {
		mapState,
		selectionManager,
		popupManager,
		interactionManager
	});

	const layersInitialized = mapState.initializeLayers();

	$effect(() => {
		const currentProject = $selectedProject;
		untrack(() => {
			if (mapState.olMap && currentProject !== mapState.selectedProject) {
				mapState.reinitializeForProject(currentProject);
				selectionManager.clearSelection();
			}
		});
	});

	$effect(() => {
		const isGlobal = $globalMapView;
		untrack(() => {
			if (mapState.olMap) {
				mapState.reinitializeForGlobalView(isGlobal);
			}
		});
	});

	$effect(() => {
		mapState.refreshTileSources();
	});

	$effect(() => {
		const styles = $nodeTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateNodeLayerStyle(styles);
		}
	});

	$effect(() => {
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		mapState.updateTrenchLayerStyle(mode, surfaceStyles, constructionTypeStyles, color);
	});

	$effect(() => {
		const color = $addressStyle.color;
		const size = $addressStyle.size;
		mapState.updateAddressLayerStyle(color, size);
	});

	$effect(() => {
		const styles = $areaTypeStyles;
		if (Object.keys(styles).length > 0) {
			mapState.updateAreaLayerStyle(styles);
		}
	});

	$effect(() => {
		const config = $labelVisibilityConfig;
		const mode = $trenchStyleMode;
		const surfaceStyles = $trenchSurfaceStyles;
		const constructionTypeStyles = $trenchConstructionTypeStyles;
		const color = $trenchColor;
		const nodeStyles = $nodeTypeStyles;
		const areaStyles = $areaTypeStyles;

		if (config.trench !== undefined) {
			mapState.updateLabelVisibility('trench', config.trench, {
				mode,
				surfaceStyles,
				constructionTypeStyles,
				color
			});
		}
		if (config.conduit !== undefined) {
			mapState.updateLabelVisibility('conduit', config.conduit, {
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
	 * Initializes selection layers, popup overlay, and interaction handlers when the map is ready.
	 * @param {{ map: import('ol').Map, usingFallbackOSM: boolean }} detail
	 */
	function handleMapReady({ map: olMapInstance }) {
		mapState.initializeSelectionLayers(
			olMapInstance,
			() => /** @type {Record<string, boolean>} */ (selectionManager.getSelectionStore())
		);

		const selectionLayers = mapState.getSelectionLayers();
		selectionLayers.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		popupManager.initialize(olMapInstance);

		const layers = mapState.getLayerReferences();
		interactionManager.initialize(olMapInstance, layers, searchPanelRef);
	}

	$effect(() => {
		if (mapRef && mapRef.getSearchPanelRef) {
			searchPanelRef = mapRef.getSearchPanelRef();
			if (searchPanelRef) {
				interactionManager.setSearchPanelRef(searchPanelRef);
			}
		}
	});

	onMount(() => {
		startHeartbeat();

		return () => {
			stopHeartbeat();
			mapState.cleanup();
			selectionManager.cleanup();
			if (mapState.olMap) popupManager.cleanup(mapState.olMap);
			interactionManager.cleanup();
		};
	});

	// svelte-ignore state_referenced_locally
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
					areaTypes={data.areaTypes ?? []}
					projectId={$selectedProject}
					onready={handleMapReady}
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
