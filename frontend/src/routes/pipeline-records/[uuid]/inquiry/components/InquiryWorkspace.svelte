<script lang="ts">
	import type OlFeature from 'ol/Feature';
	import type OlMap from 'ol/Map';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { IconEdit, IconEditOff, IconPencilOff, IconPolygon } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { InquiryDrawManager } from '$lib/classes/InquiryDrawManager.svelte';
	import { MapState } from '$lib/classes/MapState.svelte';
	import Map from '$lib/components/Map.svelte';
	import MapHint from '$lib/components/MapHint.svelte';
	import { syncLayerStyles } from '$lib/map/layerStyleSync';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import { selectedProject, trenchColorSelected } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { tooltip } from '$lib/utils/tooltip';
	import { getLayerStyleAttributes } from '$lib/remote/map/layers.remote';
	import {
		createInquiryArea,
		getInquiryAreas,
		updateInquiryAreaGeometry
	} from '$lib/remote/pipeline-records/inquiry-areas.remote';
	import { getPipelineRecord } from '$lib/remote/pipeline-records/records.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import InquiryAreaList from './InquiryAreaList.svelte';
	import { toAreaFeatures, toWgs84Polygon } from './inquiryGeometry';

	import 'ol/ol.css';

	let { recordUuid }: { recordUuid: string } = $props();

	const mapState = new MapState(get(selectedProject), get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});
	const layersInitialized = mapState.initializeLayers();
	const drawManager = new InquiryDrawManager();

	let isSaving = $state(false);

	const TOOL_BUTTON =
		'w-9 h-9 rounded-md flex items-center justify-center transition-all shadow-sm';
	const TOOL_ACTIVE = 'bg-warning-500 text-white';
	const TOOL_IDLE =
		'bg-surface-50-950 border border-surface-200-800 text-surface-600-400 hover:bg-surface-200-800';

	onMount(() => {
		const stopStyleSync = syncLayerStyles(mapState);

		return () => {
			stopStyleSync();
			drawManager.olMap?.un('moveend', handleMoveEnd);
			drawManager.cleanup();
			mapState.cleanup();
		};
	});

	const areasQuery = $derived(getInquiryAreas(recordUuid));

	// An unknown record fails the boundary instead of offering a map nothing can be saved on.
	// svelte-ignore state_referenced_locally
	const [attributes] = await Promise.all([
		getLayerStyleAttributes(),
		getPipelineRecord(recordUuid)
	]);
	const areas = $derived(await areasQuery);

	function handleMoveEnd() {
		if (areas.length > 0) drawManager.refreshHighlights();
	}

	/**
	 * Adds the polygon layer and one highlight overlay per data layer when the
	 * map is ready.
	 * @param detail - Map ready event with the OpenLayers map instance
	 */
	function handleMapReady({ map }: { map: OlMap }) {
		drawManager.initialize(map);

		const dataLayers = [
			{ layer: mapState.vectorTileLayer, isPoint: false },
			{ layer: mapState.areaLayer, isPoint: false },
			{ layer: mapState.addressLayer, isPoint: true },
			{ layer: mapState.nodeLayer, isPoint: true }
		];
		drawManager.initializeHighlightLayers(
			dataLayers.flatMap(({ layer, isPoint }) => {
				const source = layer?.getSource();
				return layer && source ? [{ source, parentLayer: layer, isPoint }] : [];
			})
		);

		map.on('moveend', handleMoveEnd);
	}

	/**
	 * Mirrors the saved areas onto the map. As an attachment it re-runs when the
	 * areas change or the map becomes ready.
	 */
	function showAreas() {
		const map = drawManager.olMap;
		if (!map) return;

		registerStorageProjection(page.data.srid, page.data.proj4Def);
		drawManager.renderPolygons(
			toAreaFeatures(areas),
			storageProjection(page.data.srid),
			map.getView().getProjection()
		);
		drawManager.updatePolygonGeometryCache();
		drawManager.refreshHighlights();
	}

	function toggleDrawing() {
		if (drawManager.isDrawing) {
			drawManager.stopDrawing();
		} else {
			drawManager.startDrawing(handleDrawEnd);
		}
	}

	function toggleEditing() {
		if (drawManager.isEditing) {
			drawManager.stopEditing();
		} else {
			drawManager.startEditing(handleModifyEnd);
		}
	}

	/**
	 * Saves a finished sketch; the refreshed areas replace it on the map.
	 * @param feature - The drawn polygon feature
	 */
	async function handleDrawEnd(feature: OlFeature) {
		const map = drawManager.olMap;
		const geometry = map && toWgs84Polygon(feature, map.getView().getProjection());
		if (!geometry) return;

		isSaving = true;
		try {
			await createInquiryArea({ recordUuid, geometry });
			globalToaster.success({
				title: m.title_success(),
				description: m.message_inquiry_polygon_saved()
			});
		} catch (err) {
			showAreas();
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_inquiry_polygon_save_failed()
			});
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Saves a modified polygon, or puts the saved shape back when the backend refuses.
	 * @param feature - The modified polygon feature
	 */
	async function handleModifyEnd(feature: OlFeature) {
		const map = drawManager.olMap;
		const areaUuid = feature.get('uuid');
		const geometry = map && toWgs84Polygon(feature, map.getView().getProjection());
		if (typeof areaUuid !== 'string' || !geometry) return;

		isSaving = true;
		try {
			await updateInquiryAreaGeometry({ recordUuid, areaUuid, geometry });
			globalToaster.success({
				title: m.title_success(),
				description: m.message_inquiry_polygon_updated()
			});
		} catch (err) {
			showAreas();
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_inquiry_polygon_update_failed()
			});
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="flex-1 flex flex-col lg:flex-row lg:gap-4 overflow-hidden">
	<div
		class="order-1 h-[40vh] shrink-0 border-2 rounded-lg border-surface-200-800 overflow-hidden relative sm:h-[45vh] lg:h-auto lg:flex-2"
		{@attach showAreas}
	>
		{#if !layersInitialized}
			<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
				<p>{m.message_error_could_not_load_map_tiles()}</p>
			</div>
		{:else}
			<Map
				className="rounded-lg overflow-hidden h-full w-full"
				layers={mapState.getLayers()}
				showLayerVisibilityTree={true}
				showSearchPanel={true}
				onready={handleMapReady}
				onLayerVisibilityChanged={() => drawManager.refreshHighlights()}
				nodeTypes={attributes.nodeTypes}
				surfaces={attributes.surfaces}
				constructionTypes={attributes.constructionTypes}
				areaTypes={attributes.areaTypes}
			/>

			<div class="absolute top-16 left-4 z-10 flex flex-col gap-1">
				<button
					type="button"
					class={[TOOL_BUTTON, drawManager.isDrawing ? TOOL_ACTIVE : TOOL_IDLE]}
					disabled={isSaving || drawManager.isEditing}
					title={drawManager.isDrawing ? m.action_stop_drawing() : m.action_draw_polygon()}
					{@attach tooltip(
						drawManager.isDrawing ? m.action_stop_drawing() : m.action_draw_polygon(),
						{ position: 'right' }
					)}
					onclick={toggleDrawing}
				>
					{#if drawManager.isDrawing}
						<IconPencilOff class="size-4" />
					{:else}
						<IconPolygon class="size-4" />
					{/if}
				</button>

				{#if areas.length > 0 || drawManager.isEditing}
					<button
						type="button"
						class={[TOOL_BUTTON, drawManager.isEditing ? TOOL_ACTIVE : TOOL_IDLE]}
						disabled={isSaving || drawManager.isDrawing}
						title={drawManager.isEditing ? m.action_stop_editing() : m.action_edit_polygon()}
						{@attach tooltip(
							drawManager.isEditing ? m.action_stop_editing() : m.action_edit_polygon(),
							{ position: 'right' }
						)}
						onclick={toggleEditing}
					>
						{#if drawManager.isEditing}
							<IconEditOff class="size-4" />
						{:else}
							<IconEdit class="size-4" />
						{/if}
					</button>
				{/if}
			</div>

			<MapHint
				message={m.message_inquiry_draw_hint()}
				visible={areas.length === 0 && !drawManager.isDrawing}
			/>
		{/if}
	</div>

	<InquiryAreaList {recordUuid} {areas} />
</div>
