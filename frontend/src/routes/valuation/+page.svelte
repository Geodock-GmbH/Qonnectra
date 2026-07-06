<script>
	import { SvelteSet } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import { deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { IconCalculator, IconChartAreaLine } from '@tabler/icons-svelte';
	import GeoJSON from 'ol/format/GeoJSON.js';
	import VectorLayer from 'ol/layer/Vector.js';
	import VectorSource from 'ol/source/Vector.js';
	import { Fill, Stroke, Style } from 'ol/style.js';

	import { m } from '$lib/paraglide/messages';

	import { MapState } from '$lib/classes/MapState.svelte.js';
	import Map from '$lib/components/Map.svelte';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import { selectedProject, trenchColorSelected } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import { computeProjection, formatCurrency, formatQuantity } from './valuationCalc.js';

	let { data } = $props();

	const areas = $derived(
		/** @type {Array<{uuid: string, name: string, geom: any}>} */ (data.areas ?? [])
	);
	const rates = $derived(/** @type {any[]} */ (data.rates ?? []));
	const nodeTypes = $derived(/** @type {any[]} */ (data.nodeTypes ?? []));

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
	let baseYear = $state('2025');
	let annualCorrectionPercent = $state('2.5');

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
		if (baseYear !== '') formData.append('baseYear', baseYear);
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

<div class="flex flex-col h-full gap-4 p-4">
	<div class="flex items-center gap-2 shrink-0">
		<IconChartAreaLine class="size-6 text-primary-500" />
		<h1 class="text-xl font-semibold">{m.valuation_title()}</h1>
	</div>

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
				/>
			{/if}
		</div>

		<!-- Control + results panel -->
		<div
			class="order-2 min-w-0 flex-1 border-2 rounded-lg border-surface-200-800 overflow-y-auto flex flex-col pb-16 md:pb-0 lg:w-120 lg:flex-none lg:shrink-0"
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
					<div class="max-h-40 overflow-y-auto space-y-1 pl-1">
						{#each areas as area (area.uuid)}
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
									<th class="text-right">{m.valuation_rate()}</th>
									<th class="text-right">{m.valuation_quantity()}</th>
									<th class="text-right">{m.valuation_gp()}</th>
								</tr>
							</thead>
							<tbody>
								{#each result.categories as row (row.name)}
									<tr>
										<td>{row.name}</td>
										<td class="text-right whitespace-nowrap">
											{formatCurrency(row.amount)}
											<span class="text-surface-400 text-xs">/ {unitLabel(row.unit)}</span>
										</td>
										<td class="text-right">{formatQuantity(row.quantity)}</td>
										<td class="text-right whitespace-nowrap">{formatCurrency(row.gp)}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-semibold">
									<td colspan="3">{m.valuation_total()}</td>
									<td class="text-right whitespace-nowrap">{formatCurrency(result.total)}</td>
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
										<th class="text-right">{m.valuation_net_value()}</th>
										<th class="text-right">{m.valuation_increase()}</th>
									</tr>
								</thead>
								<tbody>
									{#each projectionRows as row (row.year)}
										<tr>
											<td>{row.year}</td>
											<td class="text-right whitespace-nowrap">{formatCurrency(row.netValue)}</td>
											<td class="text-right whitespace-nowrap">{formatCurrency(row.increase)}</td>
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
