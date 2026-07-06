<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		IconArrowLeft,
		IconEdit,
		IconEditOff,
		IconPencilOff,
		IconPolygon,
		IconTrash
	} from '@tabler/icons-svelte';
	import GeoJSON from 'ol/format/GeoJSON.js';

	import { m } from '$lib/paraglide/messages';

	import { InquiryDrawManager } from '$lib/classes/InquiryDrawManager.svelte.js';
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
	import { tooltip } from '$lib/utils/tooltip.js';

	import { createInquiryContext } from './inquiryContext.svelte.js';

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

		/** @type {Array<{source: import('ol/source/VectorTile').default, parentLayer: import('ol/layer/VectorTile').default, isPoint: boolean}>} */
		const sources = [];
		const vtLayer = mapState.vectorTileLayer;
		const vtSource = vtLayer?.getSource();
		if (vtLayer && vtSource) {
			sources.push({ source: vtSource, parentLayer: vtLayer, isPoint: false });
		}
		const areaLayer = mapState.areaLayer;
		const areaSource = areaLayer?.getSource();
		if (areaLayer && areaSource) {
			sources.push({ source: areaSource, parentLayer: areaLayer, isPoint: false });
		}
		const addrLayer = mapState.addressLayer;
		const addrSource = addrLayer?.getSource();
		if (addrLayer && addrSource) {
			sources.push({ source: addrSource, parentLayer: addrLayer, isPoint: true });
		}
		const nodeLayer = mapState.nodeLayer;
		const nodeSource = nodeLayer?.getSource();
		if (nodeLayer && nodeSource) {
			sources.push({ source: nodeSource, parentLayer: nodeLayer, isPoint: true });
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

		const srid = page.data.srid;
		const proj4Def = page.data.proj4Def;
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
			if (drawManager.isEditing) {
				drawManager.stopEditing();
				ctx.setEditing(false);
			}
			ctx.setDrawing(true);
			drawManager.startDrawing(handleDrawEnd);
		}
	}

	function toggleEditing() {
		if (drawManager.isEditing) {
			drawManager.stopEditing();
			ctx.setEditing(false);
		} else {
			if (drawManager.isDrawing) {
				drawManager.stopDrawing();
				ctx.setDrawing(false);
			}
			ctx.setEditing(true);
			drawManager.startEditing(handleModifyEnd);
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
	 * @param {import('ol/Feature').default} feature
	 */
	async function handleModifyEnd(feature) {
		if (!olMap) return;

		const uuid = feature.get('uuid');
		if (!uuid) return;

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
		formData.append('polygonUuid', uuid);
		formData.append('geojson', JSON.stringify(geojsonGeom));

		try {
			const response = await fetch('?/updatePolygon', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				const saved = /** @type {any} */ (result).data?.polygon;
				const storedGeom = saved?.geometry ?? geojsonGeom;
				ctx.updatePolygonGeom(uuid, storedGeom);
				drawManager.updatePolygonGeometryCache();
				drawManager.refreshHighlights();
				globalToaster.success({
					title: m.title_success(),
					description: m.message_inquiry_polygon_updated()
				});
			} else {
				renderPolygonsOnMap();
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_inquiry_polygon_update_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			renderPolygonsOnMap();
			globalToaster.error({ title: m.common_error(), description: err.message });
		} finally {
			ctx.setSaving(false);
		}
	}

	/**
	 * @param {string} uuid
	 * @param {string} name
	 */
	async function handleRenamePolygon(uuid, name) {
		const trimmed = name.trim();
		if (!trimmed) return;

		const current = ctx.polygons.find((p) => p.uuid === uuid);
		if (current && current.name === trimmed) return;

		const formData = new FormData();
		formData.append('polygonUuid', uuid);
		formData.append('name', trimmed);

		try {
			const response = await fetch('?/renamePolygon', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				ctx.updatePolygonName(uuid, trimmed);
				renderPolygonsOnMap();
			} else {
				globalToaster.error({
					title: m.common_error(),
					description:
						/** @type {any} */ (result).data?.message || m.message_inquiry_polygon_rename_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
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
	<div class="flex items-center">
		<button
			type="button"
			class="btn preset-tonal-surface inline-flex items-center gap-2"
			onclick={() => goto(`/pipeline-records/${page.params.uuid}`)}
		>
			<IconArrowLeft class="size-4 shrink-0" />
			<span>{m.common_back()}</span>
		</button>
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

						<div class="absolute top-16 left-4 z-10 flex flex-col gap-1">
							<button
								type="button"
								class="w-9 h-9 rounded-md flex items-center justify-center transition-all shadow-sm
									{ctx.isDrawing
									? 'bg-warning-500 text-white'
									: 'bg-surface-50-950 border border-surface-200-800 text-surface-600-400 hover:bg-surface-200-800'}"
								disabled={ctx.isSaving || ctx.isEditing}
								title={ctx.isDrawing ? m.action_stop_drawing() : m.action_draw_polygon()}
								{@attach tooltip(
									ctx.isDrawing ? m.action_stop_drawing() : m.action_draw_polygon(),
									{ position: 'right' }
								)}
								onclick={toggleDrawing}
							>
								{#if ctx.isDrawing}
									<IconPencilOff class="size-4" />
								{:else}
									<IconPolygon class="size-4" />
								{/if}
							</button>

							{#if ctx.polygons.length > 0}
								<button
									type="button"
									class="w-9 h-9 rounded-md flex items-center justify-center transition-all shadow-sm
										{ctx.isEditing
										? 'bg-warning-500 text-white'
										: 'bg-surface-50-950 border border-surface-200-800 text-surface-600-400 hover:bg-surface-200-800'}"
									disabled={ctx.isSaving || ctx.isDrawing}
									title={ctx.isEditing ? m.action_stop_editing() : m.action_edit_polygon()}
									onclick={toggleEditing}
									{@attach tooltip(
										ctx.isEditing ? m.action_stop_editing() : m.action_edit_polygon(),
										{ position: 'right' }
									)}
								>
									{#if ctx.isEditing}
										<IconEditOff class="size-4" />
									{:else}
										<IconEdit class="size-4" />
									{/if}
								</button>
							{/if}
						</div>

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
								<input
									type="text"
									class="input text-sm bg-transparent border-0 px-1 py-0.5 truncate focus:bg-surface-50-950"
									value={polygon.name || `${m.label_inquiry_polygon_default()} ${i + 1}`}
									aria-label={m.label_inquiry_area_name()}
									onblur={(e) => handleRenamePolygon(polygon.uuid, e.currentTarget.value)}
									onkeydown={(e) => {
										if (e.key === 'Enter') e.currentTarget.blur();
										else if (e.key === 'Escape') {
											e.currentTarget.value = polygon.name || '';
											e.currentTarget.blur();
										}
									}}
								/>
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
