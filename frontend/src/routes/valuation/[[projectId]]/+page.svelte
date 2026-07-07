<script>
	import { SvelteSet } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { IconCalculator, IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';
	import GeoJSON from 'ol/format/GeoJSON.js';
	import VectorLayer from 'ol/layer/Vector.js';
	import VectorSource from 'ol/source/Vector.js';
	import { Fill, Stroke, Style } from 'ol/style.js';

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

	import { computeProjection, formatCurrency, formatQuantity } from './valuationCalc.js';

	let { data } = $props();

	const areas = $derived(
		/** @type {Array<{uuid: string, name: string, areaType: string | null, geom: any}>} */ (
			data.areas ?? []
		)
	);
	const rates = $derived(/** @type {any[]} */ (data.rates ?? []));
	const nodeTypes = $derived(/** @type {any[]} */ (data.nodeTypes ?? []));
	const surfaces = $derived(/** @type {any[]} */ (data.surfaces ?? []));
	const constructionTypes = $derived(/** @type {any[]} */ (data.constructionTypes ?? []));
	const areaTypes = $derived(/** @type {any[]} */ (data.areaTypes ?? []));

	/**
	 * @param {string} unit
	 * @returns {string}
	 */
	function unitLabel(unit) {
		return unit === 'per_meter' ? m.valuation_unit_per_meter() : m.valuation_unit_per_piece();
	}

	const mapState = new MapState($selectedProject, get(trenchColorSelected), {
		trench: true,
		address: true,
		node: true,
		area: true
	});
	const layersInitialized = mapState.initializeLayers();

	/** @type {import('ol/Map').default | null} */
	let olMap = $state(null);
	/** @type {VectorLayer<VectorSource> | null} */
	let highlightLayer = null;

	let gesamt = $state(true);
	const selectedAreaUuids = new SvelteSet();
	const collapsedGroups = new SvelteSet();
	const currentYear = new Date().getFullYear();
	let baseYear = $state(currentYear);
	let annualCorrectionPercent = $state('2.5');

	const groupedAreas = $derived.by(() => {
		/** @type {globalThis.Map<string, typeof areas>} */
		const groups = new globalThis.Map();
		for (const area of areas) {
			const key = area.areaType ?? m.valuation_no_area_type();
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)?.push(area);
		}
		return Array.from(groups, ([type, items]) => ({ type, areas: items }));
	});

	let isCalculating = $state(false);
	/** @type {any} */
	let result = $state(null);

	const selectionValid = $derived(gesamt || selectedAreaUuids.size > 0);

	/**
	 * Recompute the projection client-side so the table reacts to input tweaks
	 * without a server round-trip once a base result exists.
	 */
	const projectionRows = $derived.by(() => {
		if (!result) return [];
		const year = Number(baseYear);
		const correction = Number(annualCorrectionPercent) / 100;
		if (!year || annualCorrectionPercent === '' || !Number.isFinite(correction)) return [];
		return computeProjection(Number(result.total), year, correction);
	});

	const highlightStyle = new Style({
		stroke: new Stroke({ color: '#f59e0b', width: 3 }),
		fill: new Fill({ color: 'rgba(245, 158, 11, 0.15)' })
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
	 * Initialises the highlight layer once the map is ready.
	 * @param {{ map: import('ol/Map').default }} event
	 */
	function handleMapReady({ map }) {
		olMap = map;
		const source = new VectorSource();
		highlightLayer = new VectorLayer({ source, style: highlightStyle, zIndex: 90 });
		map.addLayer(highlightLayer);
		renderHighlight();
	}

	/** Draws the outlines of the currently selected areas on the map. */
	function renderHighlight() {
		if (!olMap || !highlightLayer) return;
		const source = highlightLayer.getSource();
		if (!source) return;
		source.clear();

		if (gesamt) return;

		const srid = page.data.srid;
		const proj4Def = page.data.proj4Def;
		if (srid && proj4Def) {
			registerStorageProjection(srid, proj4Def);
		}
		const dataProjection = srid ? storageProjection(srid) : 'EPSG:25832';
		const format = new GeoJSON();

		const selected = areas.filter((a) => selectedAreaUuids.has(a.uuid) && a.geom);
		for (const area of selected) {
			const feature = format.readFeature(
				{ type: 'Feature', geometry: area.geom, properties: {} },
				{ dataProjection, featureProjection: olMap.getView().getProjection() }
			);
			source.addFeature(/** @type {import('ol/Feature').default} */ (feature));
		}
	}

	function toggleGesamt() {
		gesamt = !gesamt;
		if (gesamt) {
			selectedAreaUuids.clear();
		}
		renderHighlight();
	}

	/**
	 * @param {string} uuid
	 */
	function toggleArea(uuid) {
		if (selectedAreaUuids.has(uuid)) {
			selectedAreaUuids.delete(uuid);
		} else {
			selectedAreaUuids.add(uuid);
			gesamt = false;
		}
		renderHighlight();
	}

	async function runCalculation() {
		if (!selectionValid || isCalculating) return;
		isCalculating = true;

		const formData = new FormData();
		formData.append('project', String(data.projectId));
		formData.append('areaUuids', JSON.stringify(gesamt ? [] : Array.from(selectedAreaUuids)));
		formData.append('baseYear', String(baseYear));
		if (annualCorrectionPercent !== '') {
			formData.append('annualCorrection', String(Number(annualCorrectionPercent) / 100));
		}

		try {
			const response = await fetch('?/calculate', { method: 'POST', body: formData });
			const parsed = deserialize(await response.text());

			if (parsed.type === 'success') {
				result = /** @type {any} */ (parsed).data?.result ?? null;
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: /** @type {any} */ (parsed).data?.message || m.valuation_result_failed()
				});
			}
		} catch (/** @type {any} */ err) {
			globalToaster.error({ title: m.common_error(), description: err.message });
		} finally {
			isCalculating = false;
		}
	}
</script>

<div class="flex flex-col h-full p-4">
	<div class="flex-1 flex flex-col lg:flex-row lg:gap-4 overflow-hidden">
		<!-- Map -->
		<div
			class="order-1 h-[40vh] shrink-0 border-2 rounded-lg border-surface-200-800 overflow-hidden relative sm:h-[45vh] lg:h-auto lg:flex-2"
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
					{nodeTypes}
					{surfaces}
					{constructionTypes}
					{areaTypes}
				/>
				<MapHint message={m.message_valuation()} />
			{/if}
		</div>

		<!-- Control + results panel -->
		<div
			class="order-2 min-w-0 flex-1 border-2 rounded-lg border-surface-200-800 overflow-y-auto flex flex-col pb-16 md:pb-0 lg:w-160 lg:flex-none lg:shrink-0"
		>
			<!-- Area selection -->
			<div class="p-3 border-b border-surface-200-800 space-y-2">
				<h2 class="text-sm font-semibold text-surface-600-400">{m.valuation_area_select()}</h2>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" class="checkbox" checked={gesamt} onchange={toggleGesamt} />
					<span class="text-sm">{m.valuation_area_gesamt()}</span>
				</label>

				{#if areas.length === 0}
					<p class="text-xs text-surface-500">{m.valuation_no_areas()}</p>
				{:else}
					<div class="max-h-60 overflow-y-auto space-y-1">
						{#each groupedAreas as group (group.type)}
							<div>
								<button
									type="button"
									class="flex items-center gap-1 w-full text-left text-sm font-medium py-1 hover:text-primary-500"
									onclick={() => {
										if (collapsedGroups.has(group.type)) {
											collapsedGroups.delete(group.type);
										} else {
											collapsedGroups.add(group.type);
										}
									}}
								>
									{#if collapsedGroups.has(group.type)}
										<IconChevronRight class="size-4 shrink-0" />
									{:else}
										<IconChevronDown class="size-4 shrink-0" />
									{/if}
									<span class="truncate">{group.type}</span>
									<span class="text-xs text-surface-500 ml-auto shrink-0">{group.areas.length}</span
									>
								</button>
								{#if !collapsedGroups.has(group.type)}
									<div class="pl-5 space-y-0.5">
										{#each group.areas as area (area.uuid)}
											<label class="flex items-center gap-2 cursor-pointer">
												<input
													type="checkbox"
													class="checkbox"
													checked={selectedAreaUuids.has(area.uuid)}
													onchange={() => toggleArea(area.uuid)}
												/>
												<span class="text-sm truncate">{area.name}</span>
											</label>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Projection inputs (Bereich 3) -->
			<div class="p-3 border-b border-surface-200-800 space-y-2">
				<h2 class="text-sm font-semibold text-surface-600-400">
					{m.valuation_projection_title()}
				</h2>
				<label class="block text-xs text-surface-500">
					{m.valuation_base_year()}
					<input type="number" class="input mt-1" bind:value={baseYear} placeholder="2025" />
				</label>
				<label class="block text-xs text-surface-500">
					{m.valuation_annual_correction()}
					<input
						type="number"
						step="0.1"
						class="input mt-1"
						bind:value={annualCorrectionPercent}
						placeholder="2.5"
					/>
				</label>
				<p class="text-[0.7rem] text-surface-500">{m.valuation_annual_correction_hint()}</p>
			</div>

			<!-- Calculate -->
			<div class="p-3 border-b border-surface-200-800">
				{#if rates.length === 0}
					<p class="text-xs text-warning-600 mb-2">{m.valuation_no_rates()}</p>
				{/if}
				<button
					type="button"
					class="btn preset-filled-primary-500 w-full"
					disabled={!selectionValid || isCalculating || rates.length === 0}
					onclick={runCalculation}
				>
					<IconCalculator class="size-4" />
					<span>{isCalculating ? m.valuation_calculating() : m.valuation_calculate()}</span>
				</button>
				{#if !selectionValid}
					<p class="text-xs text-surface-500 mt-2">{m.valuation_select_area_hint()}</p>
				{/if}
			</div>

			<!-- Results -->
			{#if result}
				<div class="p-3 space-y-4">
					<!-- Bereich 2 table -->
					<div class="overflow-x-auto">
						<table class="table table-compact w-full text-sm">
							<thead>
								<tr>
									<th>{m.valuation_category()}</th>
									<th>{m.valuation_rate()}</th>
									<th>{m.valuation_quantity()}</th>
									<th>{m.valuation_gp()}</th>
								</tr>
							</thead>
							<tbody>
								{#each result.categories as row (row.name)}
									<tr>
										<td>{row.name}</td>
										<td class="whitespace-nowrap">
											{formatCurrency(row.amount)}
											<span class="text-surface-400 text-xs">/ {unitLabel(row.unit)}</span>
										</td>
										<td>{formatQuantity(row.quantity)}</td>
										<td class="whitespace-nowrap">{formatCurrency(row.gp)}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-semibold">
									<td colspan="3">{m.valuation_total()}</td>
									<td class="whitespace-nowrap">{formatCurrency(result.total)}</td>
								</tr>
							</tfoot>
						</table>
					</div>

					<!-- KPIs -->
					<div class="grid grid-cols-2 gap-2">
						<div class="card preset-tonal-primary p-3">
							<div class="text-xs text-surface-500">{m.valuation_kpi_cost_per_ha()}</div>
							<div class="text-base font-semibold">
								{formatCurrency(result.cost_per_house_connection)}
							</div>
						</div>
						<div class="card preset-tonal-primary p-3">
							<div class="text-xs text-surface-500">{m.valuation_kpi_cost_per_meter()}</div>
							<div class="text-base font-semibold">{formatCurrency(result.cost_per_meter)}</div>
						</div>
					</div>

					<!-- Bereich 3 projection -->
					{#if projectionRows.length > 0}
						<div class="overflow-x-auto">
							<h3 class="text-sm font-semibold mb-1 text-surface-600-400">
								{m.valuation_projection_title()}
							</h3>
							<table class="table table-compact w-full text-sm">
								<thead>
									<tr>
										<th>{m.valuation_year()}</th>
										<th>{m.valuation_net_value()}</th>
										<th>{m.valuation_increase()}</th>
									</tr>
								</thead>
								<tbody>
									{#each projectionRows as row (row.year)}
										<tr>
											<td>{row.year}</td>
											<td class="whitespace-nowrap">{formatCurrency(row.netValue)}</td>
											<td class="whitespace-nowrap">{formatCurrency(row.increase)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
