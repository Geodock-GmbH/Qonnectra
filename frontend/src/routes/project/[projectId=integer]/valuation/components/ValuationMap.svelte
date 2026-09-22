<script lang="ts">
	import type { MapBrowserEvent } from 'ol';
	import type OlMap from 'ol/Map.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import { MapState } from '$lib/classes/MapState.svelte';
	import Map from '$lib/components/Map.svelte';
	import { syncLayerStyles } from '$lib/map/layerStyleSync';
	import { syncProjectScope } from '$lib/map/projectScopeSync';
	import { globalMapView, selectedProject, trenchColorSelected } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';
	import { getValuationAreas } from '$lib/remote/valuation/valuation.remote';

	import { getValuationState } from './ValuationState.svelte';

	import 'ol/ol.css';

	const valuation = getValuationState();

	const mapState = new MapState(
		get(selectedProject),
		get(trenchColorSelected),
		{ trench: true, address: true, node: true, area: true },
		null,
		get(globalMapView)
	);
	const layersInitialized = mapState.initializeLayers();

	/**
	 * Adds the area outlines to the map and catches up on a project or global view
	 * change that happened while the map was still loading.
	 * @param map - The ready OpenLayers map instance
	 */
	function handleMapReady({ map }: { map: OlMap }): void {
		mapState.olMap = map;
		mapState.reinitializeForProject(get(selectedProject));
		mapState.reinitializeForGlobalView(get(globalMapView));
		const { srid, proj4Def } = page.data;
		valuation.highlight.attach(map, srid && proj4Def ? { srid, proj4Def } : null);
	}

	/**
	 * Toggles the area under the cursor, provided the area list offers it.
	 * @param event - The map click event
	 */
	async function handleMapClick(event: MapBrowserEvent<PointerEvent>): Promise<void> {
		const feature = mapState.olMap?.forEachFeatureAtPixel(event.pixel, (hit) => hit, {
			layerFilter: (layer) => layer === mapState.areaLayer,
			hitTolerance: 5
		});
		const featureId = feature?.getId();
		if (!featureId) return;

		const uuid = String(featureId);
		try {
			const areas = await getValuationAreas({ projectId: valuation.areaScope });
			if (areas.some((area) => area.uuid === uuid)) valuation.toggleArea(uuid);
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_error_loading_data()
			});
		}
	}

	onMount(() => {
		const stopStyleSync = syncLayerStyles(mapState);
		const stopScopeSync = syncProjectScope(mapState);

		return () => {
			stopStyleSync();
			stopScopeSync();
			valuation.highlight.detach();
			mapState.cleanup();
		};
	});

	const attributes = $derived(await getLayerStyleAttributes());
</script>

{#if layersInitialized}
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
	/>
{:else}
	<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
		<p>{m.message_error_could_not_load_map_tiles()}</p>
	</div>
{/if}
