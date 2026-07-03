<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { IconArrowLeft, IconPencil, IconPencilOff, IconTrash } from '@tabler/icons-svelte';
	import GeoJSON from 'ol/format/GeoJSON.js';

	import { m } from '$lib/paraglide/messages';

	import { MapState } from '$lib/classes/MapState.svelte.js';
	import Map from '$lib/components/Map.svelte';
	import MapHint from '$lib/components/MapHint.svelte';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';

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

	import { createInquiryContext } from './inquiryContext.svelte.js';
	import { InquiryDrawManager } from './InquiryDrawManager.svelte.js';

	let { data } = $props();

	const nodeTypes = $derived(/** @type {any[]} */ (data.nodeTypes ?? []));
	const surfaces = $derived(/** @type {any[]} */ (data.surfaces ?? []));
	const constructionTypes = $derived(/** @type {any[]} */ (data.constructionTypes ?? []));
	const areaTypes = $derived(/** @type {any[]} */ (data.areaTypes ?? []));

	const mapState = new MapState($selectedProject, get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});

	const layersInitialized = mapState.initializeLayers();
	const ctx = createInquiryContext();
	const drawManager = new InquiryDrawManager();

	/** @type {import('ol/Map').default|null} */
	let olMap = $state(null);

	function handleMoveEnd() {
		if (ctx.polygons.length > 0) {
			drawManager.refreshHighlights();
		}
	}

	/**
	 * @param {{ map: import('ol/Map').default }} event
	 */
	function handleMapReady({ map }) {
		olMap = map;
		drawManager.initialize(map);

		const sources = [];
		if (mapState.vectorTileLayer?.getSource()) {
			sources.push({ source: mapState.vectorTileLayer.getSource(), parentLayer: mapState.vectorTileLayer, isPoint: false });
		}
		if (mapState.areaLayer?.getSource()) {
			sources.push({ source: mapState.areaLayer.getSource(), parentLayer: mapState.areaLayer, isPoint: false });
		}
		if (mapState.addressLayer?.getSource()) {
			sources.push({ source: mapState.addressLayer.getSource(), parentLayer: mapState.addressLayer, isPoint: true });
		}
		if (mapState.nodeLayer?.getSource()) {
			sources.push({ source: mapState.nodeLayer.getSource(), parentLayer: mapState.nodeLayer, isPoint: true });
		}
		drawManager.initializeHighlightLayers(sources);

		loadExistingPolygons();
		map.on('moveend', handleMoveEnd);
	}

	function loadExistingPolygons() {
		const areas = data.inquiryAreas ?? [];
		if (!areas.length) return;

		const polygons = areas.map((/** @type {any} */ f) => ({
			uuid: f.properties?.uuid ?? f.id,
			name: f.properties?.name ?? null,
			geom: f.geometry,
			created_at: f.properties?.created_at ?? ''
		}));
		ctx.setPolygons(polygons);

		renderPolygonsOnMap();
	}

	function renderPolygonsOnMap() {
		if (!olMap) return;

		const srid = $page.data.srid;
		const proj4Def = $page.data.proj4Def;
		if (srid && proj4Def) {
			registerStorageProjection(srid, proj4Def);
		}

		const geoJsonFeatures = ctx.polygons.map((p) => ({
			type: 'Feature',
			properties: { uuid: p.uuid, name: p.name },
			geometry: p.geom
		}));

		const proj = storageProjection(srid);
		drawManager.renderPolygons(geoJsonFeatures, proj, olMap.getView().getProjection());

		drawManager.updatePolygonGeometryCache();
		drawManager.refreshHighlights();
	}

	function toggleDrawing() {
		if (drawManager.isDrawing) {
			drawManager.stopDrawing();
			ctx.setDrawing(false);
		} else {
			ctx.setDrawing(true);
			drawManager.startDrawing(handleDrawEnd);
		}
	}

	/**
	 * @param {import('ol/Feature').default} feature
	 */
	async function handleDrawEnd(feature) {
		if (!olMap) return;

		ctx.setSaving(true);

		const format = new GeoJSON();
		const writeOptions = /** @type {any} */ ({
			dataProjection: 'EPSG:4326',
			featureProjection: olMap.getView().getProjection()
		});

		const geojsonGeom = format.writeGeometryObject(
			/** @type {import('ol/geom/Geometry').default} */ (feature.getGeometry()),
			writeOptions
		);

		const formData = new FormData();
		formData.append('geojson', JSON.stringify(geojsonGeom));

		try {
			const response = await fetch('?/savePolygon', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				const saved = /** @type {any} */ (result).data?.polygon;
				if (saved) {
					const props = saved.properties ?? saved;
					ctx.addPolygon({
						uuid: props.uuid ?? saved.id,
						name: props.name ?? null,
						geom: saved.geometry ?? geojsonGeom,
						created_at: props.created_at ?? ''
					});
				}
				renderPolygonsOnMap();
				globalToaster.success({
					title: m.title_success(),
					description: m.message_inquiry_polygon_saved()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_inquiry_polygon_save_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
		} finally {
			ctx.setSaving(false);
		}
	}

	/**
	 * @param {string} uuid
	 */
	async function handleDeletePolygon(uuid) {
		const formData = new FormData();
		formData.append('polygonUuid', uuid);

		try {
			const response = await fetch('?/deletePolygon', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				ctx.removePolygon(uuid);
				drawManager.removePolygonByUuid(uuid);
				renderPolygonsOnMap();
				globalToaster.success({
					title: m.title_success(),
					description: m.message_inquiry_polygon_deleted()
				});
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_inquiry_polygon_delete_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
		}
	}

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

	onMount(() => {
		return () => {
			olMap?.un('moveend', handleMoveEnd);
			drawManager.cleanup();
			mapState.cleanup();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_pipeline_inquiry()}</title>
</svelte:head>

<div class="flex flex-col h-full overflow-hidden gap-3">
	<div class="flex items-center justify-between">
		<button
			type="button"
			class="btn preset-tonal-surface inline-flex items-center gap-2"
			onclick={() => goto(`/pipeline-records/${$page.params.uuid}`)}
		>
			<IconArrowLeft class="size-4 shrink-0" />
			<span>{m.common_back()}</span>
		</button>

		<div class="flex items-center gap-3">
			{#if ctx.polygons.length > 0}
				<span class="text-sm text-surface-500">
					{ctx.polygons.length}
					{ctx.polygons.length === 1
						? m.label_inquiry_polygon_singular()
						: m.label_inquiry_polygon_plural()}
				</span>
			{/if}

			<button
				type="button"
				class="btn inline-flex items-center gap-2 {ctx.isDrawing
					? 'preset-filled-warning-500'
					: 'preset-filled-primary-500'}"
				disabled={ctx.isSaving}
				onclick={toggleDrawing}
			>
				{#if ctx.isDrawing}
					<IconPencilOff class="size-4 shrink-0" />
					<span>{m.action_stop_drawing()}</span>
				{:else}
					<IconPencil class="size-4 shrink-0" />
					<span>{m.action_draw_polygon()}</span>
				{/if}
			</button>
		</div>
	</div>

	{#if !data.recordExists}
		<div class="card preset-tonal-error p-4">Pipeline record not found.</div>
	{:else}
		<div class="flex-1 flex gap-4 overflow-hidden">
			<div class="flex-1 relative">
				{#if !layersInitialized}
					<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
						<p>{m.message_error_could_not_load_map_tiles()}</p>
					</div>
				{:else}
					<div
						class="map-wrapper border-2 rounded-lg border-surface-200-800 h-full w-full relative overflow-hidden"
					>
						<Map
							className="rounded-lg overflow-hidden h-full w-full"
							layers={mapState.getLayers()}
							showLayerVisibilityTree={true}
							showSearchPanel={true}
							onready={handleMapReady}
							onLayerVisibilityChanged={() => drawManager.refreshHighlights()}
							{nodeTypes}
							{surfaces}
							{constructionTypes}
							{areaTypes}
						/>

						<MapHint
							message={m.message_inquiry_draw_hint()}
							visible={ctx.polygons.length === 0 && !ctx.isDrawing}
						/>
					</div>
				{/if}
			</div>

			{#if ctx.polygons.length > 0}
				<div
					class="w-72 shrink-0 border-2 rounded-lg border-surface-200-800 overflow-y-auto flex flex-col"
				>
					<div class="p-3 border-b border-surface-200-800">
						<h3 class="text-sm font-semibold text-surface-600 dark:text-surface-400">
							{m.label_inquiry_areas()}
						</h3>
					</div>
					<div class="p-3 space-y-2 flex-1 overflow-y-auto">
						{#each ctx.polygons as polygon, i (polygon.uuid)}
							<div
								class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-md bg-surface-100-900"
							>
								<span class="text-sm truncate">
									{polygon.name || `${m.label_inquiry_polygon_default()} ${i + 1}`}
								</span>
								<button
									type="button"
									class="btn-icon btn-icon-sm preset-tonal-error shrink-0"
									onclick={() => handleDeletePolygon(polygon.uuid)}
								>
									<IconTrash class="size-3.5" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
