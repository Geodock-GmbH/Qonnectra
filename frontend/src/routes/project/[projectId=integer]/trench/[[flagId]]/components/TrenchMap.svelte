<script lang="ts">
	import type OlMap from 'ol/Map.js';
	import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import Map from '$lib/components/Map.svelte';
	import MapHint from '$lib/components/MapHint.svelte';
	import { syncLayerStyles } from '$lib/map/layerStyleSync';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import { syncSelectedProject } from '$lib/map/projectScopeSync';
	import {
		routingMode,
		routingTolerance,
		selectedProject,
		showLinkedTrenches,
		trenchColorSelected
	} from '$lib/stores/store';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';

	import { getTrenchAssignment } from './TrenchAssignmentState.svelte';
	import { getTrenchMapManagers } from './trenchMapContext';

	import 'ol/ol.css';

	let { alias }: { alias: Record<string, string> } = $props();

	const { mapState, selectionManager } = getTrenchMapManagers();
	const assignment = getTrenchAssignment();

	/**
	 * Initializes the selection layers and the route and linked-trench overlays
	 * when the map is ready.
	 * @param detail - Map ready event with the OpenLayers map instance
	 */
	function handleMapReady({ map }: { map: OlMap }) {
		mapState.initializeSelectionLayers(map, () => selectionManager.getSelectionStore());

		mapState
			.getSelectionLayers()
			.forEach((layer) => selectionManager.registerSelectionLayer(layer));

		assignment.trenchHighlights.setVisible(get(showLinkedTrenches));
		assignment.trenchHighlights.attach(map, mapState.vectorTileLayer?.getSource());
		assignment.routeOverlay.attach(map);
	}

	/**
	 * Hands the trench under a map click to the assignment state.
	 * @param event - OpenLayers map click event
	 */
	function handleMapClick(event: MapBrowserEvent<PointerEvent>) {
		if (!mapState.olMap) return;

		const [feature] = mapState.olMap.getFeaturesAtPixel(event.pixel, {
			hitTolerance: 10,
			layerFilter: (layer) => layer === mapState.vectorTileLayer
		});
		const label = feature?.get('id_trench');
		const uuid = feature?.getId();
		if (!feature || !label || !uuid) return;

		registerStorageProjection(page.data.srid, page.data.proj4Def);
		void assignment.pickTrench(
			{ uuid: String(uuid), label: String(label), feature },
			{
				enabled: get(routingMode),
				projectId: get(selectedProject),
				tolerance: get(routingTolerance)[0] ?? 1,
				dataProjection: storageProjection(page.data.srid)
			}
		);
	}

	onMount(() => {
		const stopStyleSync = syncLayerStyles(mapState);
		const stopProjectSync = syncSelectedProject(mapState, () => {
			assignment.selectConduit(undefined);
			assignment.trenchHighlights.clear();
			assignment.trenchHighlights.setSource(mapState.vectorTileLayer?.getSource());
		});
		mapState.refreshTileSources();

		return () => {
			stopStyleSync();
			stopProjectSync();
		};
	});

	const attributes = $derived(await getLayerStyleAttributes());
</script>

<Map
	className="rounded-lg overflow-hidden h-full w-full"
	layers={mapState.getLayers()}
	showLayerVisibilityTree={true}
	showSearchPanel={true}
	onready={handleMapReady}
	onclick={handleMapClick}
	nodeTypes={attributes.nodeTypes}
	surfaces={attributes.surfaces}
	constructionTypes={attributes.constructionTypes}
	areaTypes={attributes.areaTypes}
	searchPanelProps={{ trenchColorSelected: $trenchColorSelected, alias }}
/>

<MapHint
	message={m.message_map_hint_assign_conduit()}
	visible={assignment.conduitUuid === undefined}
/>

{#if assignment.isCalculatingRoute}
	<div
		class="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-lg"
		role="status"
	>
		<div
			class="bg-white dark:bg-surface-800 p-4 sm:p-6 rounded-xl flex items-center gap-3 sm:gap-4 shadow-2xl border border-surface-300 dark:border-surface-600"
		>
			<IconLoader2 class="size-6 sm:size-8 animate-spin text-primary-500" />
			<span class="font-semibold text-base sm:text-lg text-surface-900 dark:text-white"
				>{m.message_calculating_route()}</span
			>
		</div>
	</div>
{/if}
