<script>
	import { onMount, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import VectorTileLayer from 'ol/layer/VectorTile.js';

	import { m } from '$lib/paraglide/messages';

	import { MapInteractionManager } from '$lib/classes/MapInteractionManager.svelte.js';
	import { MapPopupManager } from '$lib/classes/MapPopupManager.svelte.js';
	import { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte.js';
	import { MapState } from '$lib/classes/MapState.svelte.js';
	import { NodeAssignmentManager } from '$lib/classes/NodeAssignmentManager.svelte.js';
	import Drawer from '$lib/components/Drawer.svelte';
	import Map from '$lib/components/Map.svelte';
	import { createLinkedTrenchStyle } from '$lib/map/styles.js';
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
	import HouseConnectionDrawerTabs from './HouseConnectionDrawerTabs.svelte';

	import 'ol/ol.css';

	/** @type {{ data: import('./$types').PageData }} */
	let { data } = $props();
	let mapRef = $state();
	let searchPanelRef = $state();

	let linkedTrenchesLayer = $state();
	let linkedTrenchUuids = $state(new Set());
	/** @type {Object<string, Set<string>>} conduitId -> Set of trenchUuids */
	let highlightsByConduit = {};

	const mapState = new MapState($selectedProject, get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});

	const selectionManager = new MapSelectionManager();
	// svelte-ignore state_referenced_locally
	const popupManager = new MapPopupManager(data.alias);
	// svelte-ignore state_referenced_locally
	const interactionManager = new MapInteractionManager(
		selectionManager,
		popupManager,
		drawerStore,
		HouseConnectionDrawerTabs,
		data.alias,
		{
			trench: true,
			address: false,
			node: false,
			area: false
		}
	);

	const nodeAssignmentManager = new NodeAssignmentManager(interactionManager);

	/**
	 * Handle highlight changes from accordion
	 * @param {string} conduitId - UUID of the conduit
	 * @param {string[]} trenchUuids - Array of trench UUIDs
	 * @param {boolean} isOpen - Whether the accordion item was opened
	 */
	function handleHighlightChange(conduitId, trenchUuids, isOpen) {
		if (isOpen) {
			highlightsByConduit[conduitId] = new Set(trenchUuids);
		} else {
			delete highlightsByConduit[conduitId];
		}

		const allTrenchUuids = new Set();
		for (const uuids of Object.values(highlightsByConduit)) {
			for (const uuid of uuids) {
				allTrenchUuids.add(uuid);
			}
		}
		linkedTrenchUuids = allTrenchUuids;

		if (linkedTrenchesLayer) {
			linkedTrenchesLayer.changed();
		}
	}

	/**
	 * Clear all trench highlights (called when drawer closes or feature changes)
	 */
	function clearAllHighlights() {
		highlightsByConduit = {};
		linkedTrenchUuids = new Set();
		if (linkedTrenchesLayer) {
			linkedTrenchesLayer.changed();
		}
	}

	interactionManager.setAdditionalDrawerProps({
		nodeAssignmentManager,
		onHighlightChange: handleHighlightChange
	});

	const layersInitialized = mapState.initializeLayers();

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

	/**
	 * Initializes map interactions, selection layers, and overlays when the OL map is ready.
	 * @param {{ map: import('ol/Map').default, usingFallbackOSM: boolean }} detail
	 */
	function handleMapReady({ map: olMapInstance }) {
		mapState.initializeSelectionLayers(
			olMapInstance,
			() =>
				/** @type {Record<string, boolean>} */ (
					/** @type {unknown} */ (selectionManager.getSelectionStore())
				)
		);

		const selectionLayers = mapState.getSelectionLayers();
		selectionLayers.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		const linkedTrenchStyle = createLinkedTrenchStyle();
		linkedTrenchesLayer = new VectorTileLayer({
			renderMode: 'vector',
			source: mapState.vectorTileLayer?.getSource() ?? undefined,
			style: function (feature) {
				if (feature.getId() && linkedTrenchUuids.has(feature.getId())) {
					return linkedTrenchStyle;
				}
				return undefined;
			},
			visible: true,
			properties: {
				isHighlightLayer: true
			}
		});
		mapState.olMap?.addLayer(linkedTrenchesLayer);

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

	let previousFeatureId = $state(null);
	$effect(() => {
		const currentFeatureId = $drawerStore.props?.featureId;
		const isOpen = $drawerStore.open;

		if (!isOpen || (currentFeatureId !== previousFeatureId && previousFeatureId !== null)) {
			clearAllHighlights();
		}

		previousFeatureId = currentFeatureId;
	});

	$effect(() => {
		const currentProject = $selectedProject;
		untrack(() => {
			if (mapState.olMap && currentProject !== mapState.selectedProject) {
				mapState.reinitializeForProject(currentProject);
				selectionManager.clearSelection();
			}
		});
	});

	onMount(() => {
		return () => {
			if (mapState.olMap && linkedTrenchesLayer) {
				mapState.olMap.removeLayer(linkedTrenchesLayer);
			}
			linkedTrenchesLayer = undefined;

			mapState.cleanup();
			selectionManager.cleanup();
			if (mapState.olMap) popupManager.cleanup(mapState.olMap);
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
					surfaces={data.surfaces ?? []}
					constructionTypes={data.constructionTypes ?? []}
					areaTypes={data.areaTypes ?? []}
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
