<script lang="ts">
	import type { PageProps } from './$types';
	import type { AddressData, MicroductData, ResidentialUnit } from '$lib/utils/addressPdf';
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { slide } from 'svelte/transition';
	import { deserialize } from '$app/forms';
	import { IconLoader2, IconMapPin, IconSearch, IconX } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import 'ol/ol.css';

	import { m } from '$lib/paraglide/messages';

	import Map from '$lib/components/Map.svelte';
	import { createAddressStyle, createTrenchStyle } from '$lib/map/styles';
	import {
		getWMSLayerVisibility,
		selectedProject,
		trenchColor,
		wmsLayerVisibilityConfig,
		wmsSourcesData
	} from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { fetchWMSAccessToken, fetchWMSSources, getWMSProxyUrl } from '$lib/utils/wmsApi';
	import { createWMSLayer } from '$lib/map';
	import { actionData } from '$lib/types/attributeCardTypes';

	import ExportDialog from './ExportDialog.svelte';

	/** A GeoJSON-ish point geometry (EPSG:3857). */
	type PointGeom = { coordinates?: number[] } | null;
	/** A GeoJSON feature carrying a geometry (linked trench). */
	type GeoJsonFeature = { geometry?: unknown; [key: string]: unknown };

	let { data }: PageProps = $props();

	const statusDevelopments = $derived(data.statusDevelopments);

	let searchQuery = $state('');
	let searchResults = $state<AddressData[]>([]);
	let searching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	let selectedAddress = $state<AddressData | null>(null);
	let residentialUnits = $state<ResidentialUnit[]>([]);
	let linkedMicroducts = $state<MicroductData[]>([]);
	let linkedTrenchGeometries = $state<GeoJsonFeature[]>([]);
	let loadingAddress = $state(false);
	let exportDialogOpen = $state(false);

	let geom3857 = $state<PointGeom>(null);
	let addressMarkerLayer = $state<import('ol/layer/Vector').default | null>(null);
	let trenchLinesLayer = $state<import('ol/layer/Vector').default | null>(null);
	let wmsLayers = $state<import('ol/layer/Base').default[]>([]);
	let mapCenter = $state<number[] | null>(null);
	let mapReady = $state(false);
	let mapContainerEl = $state<HTMLElement | null>(null);

	/**
	 * Searches for addresses via the trace-search API.
	 * @param query - Search string (minimum 2 characters).
	 */
	async function performSearch(query: string) {
		if (!query || query.length < 2) {
			searchResults = [];
			return;
		}

		searching = true;
		try {
			const params = new URLSearchParams({
				search: query,
				type: 'address',
				project: get(selectedProject)
			});

			const response = await fetch(`${PUBLIC_API_URL}trace-search/?${params}`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Search failed');

			const data = await response.json();
			searchResults = data.results || [];
		} catch (err) {
			console.error('Search error:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Search error',
				extraData: {
					from: 'PostCompactionPage.performSearch',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	/**
	 * Debounces search input and triggers a search after 300ms.
	 */
	function handleSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
		const query = e.currentTarget.value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			performSearch(query);
		}, 300);
	}

	/**
	 * Formats an address search result for display.
	 */
	function formatAddressResult(result: AddressData): string {
		const parts = [];
		if (result.street) parts.push(result.street);
		if (result.housenumber) parts.push(result.housenumber + (result.house_number_suffix || ''));
		if (result.zip_code || result.city) {
			parts.push(`${result.zip_code || ''} ${result.city || ''}`.trim());
		}
		return parts.join(', ') || (result.uuid as string | undefined)?.slice(0, 8) || '';
	}

	/**
	 * Sets up OpenLayers map layers after an address is selected.
	 */
	async function setupMapLayers() {
		if (!geom3857?.coordinates) {
			mapReady = false;
			return;
		}

		const [
			{ default: VectorLayer },
			{ default: VectorSource },
			{ default: Feature },
			{ default: Point },
			{ default: GeoJSON }
		] = await Promise.all([
			import('ol/layer/Vector'),
			import('ol/source/Vector'),
			import('ol/Feature'),
			import('ol/geom/Point'),
			import('ol/format/GeoJSON')
		]);

		const coords = geom3857.coordinates;
		mapCenter = coords;

		const pointFeature = new Feature({
			geometry: new Point(coords)
		});

		addressMarkerLayer = new VectorLayer({
			source: new VectorSource({
				features: [pointFeature]
			}),
			style: createAddressStyle(),
			zIndex: 100,
			properties: { layerId: 'address-marker' }
		});

		if (linkedTrenchGeometries.length > 0) {
			const geoJsonFormat = new GeoJSON();
			const trenchFeatures = linkedTrenchGeometries
				.filter((f: GeoJsonFeature) => f.geometry)
				.flatMap((f: GeoJsonFeature) =>
					geoJsonFormat.readFeatures(f, {
						dataProjection: 'EPSG:3857',
						featureProjection: 'EPSG:3857'
					})
				);

			if (trenchFeatures.length > 0) {
				trenchLinesLayer = new VectorLayer({
					source: new VectorSource({ features: trenchFeatures }),
					style: createTrenchStyle($trenchColor),
					zIndex: 50,
					properties: { layerId: 'trench-lines' }
				});
			}
		}

		await loadWMSLayers();
		mapReady = true;
	}

	/**
	 * Loads WMS layers for the compact map.
	 */
	async function loadWMSLayers() {
		const projectId = get(selectedProject);
		try {
			const [accessToken, sources] = await Promise.all([
				fetchWMSAccessToken(),
				fetchWMSSources(projectId)
			]);

			wmsSourcesData.set({ sources, loaded: true });

			const visibilityConfig = $wmsLayerVisibilityConfig;
			const loadedLayers = [];

			for (const source of sources) {
				if (!source.is_active) continue;

				for (const layer of source.layers) {
					if (!layer.is_enabled) continue;

					const layerId = `wms-${source.id}-${layer.name}`;
					const isVisible = getWMSLayerVisibility(visibilityConfig, projectId, layerId, true);

					const olLayer = createWMSLayer({
						proxyUrl: getWMSProxyUrl(source.id, accessToken),
						layerName: layer.name,
						layerId: layerId,
						displayName: `${source.name}: ${layer.title || layer.name}`,
						sourceId: source.id,
						sourceName: source.name,
						minZoom: layer.min_zoom ?? 8,
						maxZoom: layer.max_zoom ?? undefined,
						opacity: layer.opacity ?? 1.0
					});
					olLayer.setVisible(isVisible);
					loadedLayers.push(olLayer);
				}
			}

			wmsLayers = loadedLayers;
		} catch (error) {
			console.warn('Failed to load WMS layers for post-compaction map:', error);
		}
	}

	/**
	 * Fetches full address and residential units via server action.
	 */
	async function selectAddress(result: AddressData) {
		loadingAddress = true;
		searchResults = [];
		searchQuery = '';

		try {
			const formData = new FormData();
			formData.append('uuid', (result.uuid as string) ?? '');

			const response = await fetch('?/fetchAddress', {
				method: 'POST',
				body: formData
			});

			const actionResult = deserialize(await response.text());

			if (actionResult.type === 'success') {
				const resultData = actionData(actionResult) as
					| {
							address?: (AddressData & { geom_3857?: PointGeom }) | null;
							residentialUnits?: ResidentialUnit[];
							linkedMicroducts?: MicroductData[];
							linkedTrenchGeometries?: GeoJsonFeature[];
					  }
					| undefined;
				selectedAddress = resultData?.address ?? null;
				residentialUnits = resultData?.residentialUnits || [];
				linkedMicroducts = resultData?.linkedMicroducts || [];
				linkedTrenchGeometries = resultData?.linkedTrenchGeometries || [];
				geom3857 = resultData?.address?.geom_3857 || null;
				await setupMapLayers();
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: (actionData(actionResult)?.message as string) || 'Failed to fetch address'
				});
			}
		} catch (error) {
			console.error('Error fetching address:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching address',
				extraData: {
					from: 'PostCompactionPage.selectAddress',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to fetch address'
			});
		} finally {
			loadingAddress = false;
		}
	}

	function clearSelection() {
		selectedAddress = null;
		residentialUnits = [];
		linkedMicroducts = [];
		linkedTrenchGeometries = [];
		geom3857 = null;
		mapReady = false;
		addressMarkerLayer = null;
		trenchLinesLayer = null;
		wmsLayers = [];
		mapCenter = null;
		searchQuery = '';
		searchResults = [];
	}

	$effect(() => {
		$selectedProject;
		untrack(clearSelection);
	});
</script>

<svelte:head>
	<title>{m.nav_post_compaction()}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="card p-4 sm:p-6">
		<div class="flex items-center gap-3 mb-4">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold">{m.nav_post_compaction()}</h1>
				<p class="text-sm text-surface-600-400">{m.pc_description()}</p>
			</div>
		</div>

		{#if !selectedAddress}
			<div class="relative">
				<IconSearch
					size={20}
					class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500-400"
				/>
				<input
					type="text"
					value={searchQuery}
					oninput={handleSearchInput}
					placeholder={m.pc_search_placeholder()}
					autocomplete="off"
					spellcheck="false"
					class="w-full rounded-lg border border-surface-200-800 bg-transparent py-3 pl-12 pr-4 text-surface-900-100 placeholder:text-surface-500-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
				/>
				{#if searching}
					<IconLoader2
						size={20}
						class="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500 animate-spin"
					/>
				{/if}
			</div>

			{#if searchResults.length > 0}
				<div
					class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-200-800"
					transition:slide={{ duration: 200 }}
				>
					{#each searchResults as result (result.uuid)}
						<button
							type="button"
							onclick={() => selectAddress(result)}
							class="flex w-full items-center gap-3 border-b border-surface-100-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-100-900"
						>
							<IconMapPin size={18} class="text-error-500" />
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium text-surface-900-100">
									{formatAddressResult(result)}
								</div>
								{#if result.id_address}
									<div class="truncate text-xs text-surface-600-400">
										{result.id_address}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}

			{#if searchQuery.length >= 2 && !searching && searchResults.length === 0}
				<div
					class="mt-4 py-4 text-center text-surface-600-400"
					transition:slide={{ duration: 200 }}
				>
					{m.common_no_results()}
				</div>
			{/if}

			{#if searchQuery.length < 2 && !searching}
				<div class="mt-4 py-4 text-center text-sm text-surface-600-400">
					{m.trace_search_hint()}
				</div>
			{/if}
		{:else if loadingAddress}
			<div class="flex items-center justify-center py-12">
				<IconLoader2 size={28} class="text-primary-500 animate-spin" />
			</div>
		{:else}
			<div class="flex items-center gap-3 rounded-lg bg-surface-100-900 px-4 py-3 mb-4">
				<IconMapPin size={20} class="text-error-500" />
				<div class="min-w-0 flex-1">
					<div class="font-medium text-surface-900-100">
						{selectedAddress.street}
						{selectedAddress.housenumber}{selectedAddress.house_number_suffix || ''}
					</div>
					<div class="text-xs text-surface-600-400">
						{selectedAddress.zip_code}
						{selectedAddress.city}
						{#if selectedAddress.district}
							· {selectedAddress.district}
						{/if}
					</div>
				</div>
				<button
					type="button"
					onclick={clearSelection}
					class="rounded-full p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<IconX size={18} />
				</button>
			</div>

			<div class="space-y-4">
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
					<div>
						<span class="text-surface-500-400">{m.form_id_address({ count: 1 })}</span>
						<p class="font-mono font-medium">{selectedAddress.id_address || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_street()}</span>
						<p class="font-medium">{selectedAddress.street || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_housenumber()}</span>
						<p class="font-medium">
							{selectedAddress.housenumber ?? '–'}{selectedAddress.house_number_suffix || ''}
						</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_zip_code()}</span>
						<p class="font-medium">{selectedAddress.zip_code || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_city()}</span>
						<p class="font-medium">{selectedAddress.city || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_district()}</span>
						<p class="font-medium">{selectedAddress.district || '–'}</p>
					</div>
				</div>

				{#if geom3857?.coordinates && mapReady && addressMarkerLayer}
					<div
						bind:this={mapContainerEl}
						class="max-w-md h-64 md:h-80 rounded-lg overflow-hidden border border-surface-200-800"
					>
						<Map
							variant="compact"
							layers={[
								...wmsLayers,
								...(trenchLinesLayer ? [trenchLinesLayer] : []),
								addressMarkerLayer
							]}
							viewOptions={{
								center: mapCenter,
								zoom: 18
							}}
							showOpacitySlider={false}
							showLayerVisibilityTree={false}
							showSearchPanel={false}
						/>
					</div>
				{:else if geom3857?.coordinates}
					<div
						class="max-w-md h-64 md:h-80 rounded-lg border border-surface-200-800 flex items-center justify-center animate-pulse"
					>
						<p class="text-sm text-surface-400">{m.common_loading()}</p>
					</div>
				{:else}
					<div
						class="max-w-md h-64 md:h-80 rounded-lg border border-dashed border-surface-300-700 flex items-center justify-center"
					>
						<div class="text-center text-surface-400">
							<IconMapPin class="size-12 mx-auto mb-2 opacity-30" />
							<p class="text-sm font-medium text-surface-900-100">
								{m.message_no_location_data()}
							</p>
						</div>
					</div>
				{/if}

				<div class="border-t border-surface-200-800 pt-4">
					<button
						class="btn preset-filled-primary-500 inline-flex items-center gap-2"
						onclick={() => (exportDialogOpen = true)}
					>
						<span>{m.pc_export()}</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<ExportDialog
	bind:open={exportDialogOpen}
	address={selectedAddress}
	{residentialUnits}
	{linkedMicroducts}
	{statusDevelopments}
	{mapContainerEl}
	{geom3857}
	projectId={get(selectedProject)}
/>
