<script lang="ts">
	import type {
		MapInteractionManager,
		SearchPanelRef
	} from '$lib/classes/MapInteractionManager.svelte';
	import type { MapPopupManager } from '$lib/classes/MapPopupManager.svelte';
	import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
	import type { MapState } from '$lib/classes/MapState.svelte';
	import type OlMap from 'ol/Map.js';
	import { getContext, onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { m } from '$lib/paraglide/messages';

	import Map from '$lib/components/Map.svelte';
	import MapHint from '$lib/components/MapHint.svelte';
	import { syncLayerStyles } from '$lib/map/layerStyleSync';
	import { syncProjectScope } from '$lib/map/projectScopeSync';
	import { drawerStore } from '$lib/stores/drawer';
	import { nodeTypeStyles, selectedProject, trenchColorSelected } from '$lib/stores/store';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';

	import 'ol/ol.css';

	let { alias }: { alias: Record<string, string> } = $props();

	const { mapState, selectionManager, popupManager, interactionManager } = getContext<{
		mapState: MapState;
		selectionManager: MapSelectionManager;
		popupManager: MapPopupManager;
		interactionManager: MapInteractionManager;
	}>('mapManagers');

	let mapRef: ReturnType<typeof Map> | null = null;

	// The search panel mounts after the map is ready, so its highlight layer is
	// looked up at the moment a highlight has to be cleared.
	const searchPanel: SearchPanelRef = {
		getHighlightLayer: () =>
			(mapRef?.getSearchPanelRef() as SearchPanelRef | undefined)?.getHighlightLayer?.()
	};

	/**
	 * Initializes selection layers, popup overlay, and interaction handlers when the map is ready.
	 * @param detail - Map ready event with the OpenLayers map instance
	 */
	function handleMapReady({ map }: { map: OlMap }) {
		mapState.initializeSelectionLayers(
			map,
			() => selectionManager.getSelectionStore(),
			() => get(nodeTypeStyles)
		);

		mapState
			.getSelectionLayers()
			.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		popupManager.initialize(map);
		interactionManager.initialize(map, mapState.getLayerReferences(), searchPanel);
	}

	onMount(() => {
		const stopStyleSync = syncLayerStyles(mapState);
		const stopScopeSync = syncProjectScope(mapState, () => selectionManager.clearSelection());
		mapState.refreshTileSources();

		return () => {
			stopStyleSync();
			stopScopeSync();
		};
	});

	const attributes = $derived(await getLayerStyleAttributes());
</script>

<div class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full">
	<Map
		className="rounded-lg overflow-hidden"
		layers={mapState.getLayers()}
		nodeTypes={attributes.nodeTypes}
		surfaces={attributes.surfaces}
		constructionTypes={attributes.constructionTypes}
		areaTypes={attributes.areaTypes}
		projectId={$selectedProject}
		onready={handleMapReady}
		searchPanelProps={{ trenchColorSelected: $trenchColorSelected, alias }}
		bind:this={mapRef}
	/>
	<div id="popup" class="ol-popup bg-primary-500 rounded-lg border-2 border-primary-600">
		<!-- svelte-ignore a11y_invalid_attribute -->
		<a href="#" id="popup-closer" class="ol-popup-closer" aria-label="Close popup"></a>
		<div id="popup-content"></div>
	</div>
</div>
<MapHint message={m.message_map_hint_map_infos()} visible={$drawerStore.open == false} />

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
