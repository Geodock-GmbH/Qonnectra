<script lang="ts">
	import 'ol/ol.css';

	import type { GeoJsonFeature } from '$lib/types/geo';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { IconMapPin } from '@tabler/icons-svelte';
	import proj4 from 'proj4';

	import { m } from '$lib/paraglide/messages';

	import Map from '$lib/components/Map.svelte';
	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import { createAddressStyle, createTrenchStyle } from '$lib/map/styles';
	import {
		getWMSLayerVisibility,
		trenchColor,
		wmsLayerVisibilityConfig,
		wmsSourcesData
	} from '$lib/stores/store';
	import { tooltip } from '$lib/utils/tooltip';
	import { fetchWMSAccessToken, fetchWMSSources, getWMSProxyUrl } from '$lib/utils/wmsApi';
	import { createWMSLayer } from '$lib/map';
	import { getAddress, getLinkedTrenches } from '$lib/remote/address/addresses.remote';

	import AddressPdfDownload from './AddressPdfDownload.svelte';

	let { uuid, projectId }: { uuid: string; projectId: string } = $props();

	const loaded = $derived(await Promise.all([getAddress(uuid), getLinkedTrenches(uuid)]));
	const address = $derived(loaded[0]);
	const linkedTrenchGeometries = $derived(loaded[1]);
	const geom3857 = $derived(address.geom_3857);

	let addressMarkerLayer = $state<import('ol/layer/Vector').default | null>(null);
	let trenchLinesLayer = $state<import('ol/layer/Vector').default | null>(null);
	let wmsLayers = $state<import('ol/layer/Base').default[]>([]);
	let mapCenter = $state<number[] | null>(null);
	let mapReady = $state(false);
	let mapContainerEl = $state<HTMLElement | null>(null);

	const coords4326 = $derived(convert3857To4326());
	const coordsDefault = $derived(convert3857ToDefault());

	/**
	 * Load WMS layers for the compact map.
	 */
	async function loadWMSLayers() {
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
			console.warn('Failed to load WMS layers for address detail map:', error);
		}
	}

	onMount(async () => {
		const coords = geom3857?.coordinates;
		if (!coords) return;
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

		mapCenter = coords;

		addressMarkerLayer = new VectorLayer({
			source: new VectorSource({
				features: [new Feature({ geometry: new Point(coords) })]
			}),
			style: createAddressStyle(),
			zIndex: 100,
			properties: { layerId: 'address-marker' }
		});

		if (linkedTrenchGeometries.length > 0) {
			const geoJsonFormat = new GeoJSON();
			const trenchFeatures = linkedTrenchGeometries
				.filter((f: GeoJsonFeature) => f.geometry)
				.map((f: GeoJsonFeature) =>
					geoJsonFormat.readFeature(f, {
						dataProjection: 'EPSG:3857',
						featureProjection: 'EPSG:3857'
					})
				) as import('ol/Feature').default[];

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
	});

	/**
	 * Converts the geometry from EPSG:3857 to EPSG:4326 (lat/lon).
	 * @returns Formatted coordinate string or null if no geometry.
	 */
	function convert3857To4326(): string | null {
		if (!geom3857?.coordinates) return null;
		const coords = proj4('EPSG:3857', 'EPSG:4326', geom3857.coordinates);
		return `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
	}

	/**
	 * Converts the geometry from EPSG:3857 to the project's storage SRID.
	 * @returns Formatted coordinate string or null if no geometry.
	 */
	function convert3857ToDefault(): string | null {
		if (!geom3857?.coordinates) return null;
		registerStorageProjection(page.data.srid, page.data.proj4Def);
		const coords = proj4('EPSG:3857', storageProjection(page.data.srid), geom3857.coordinates);
		return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
	}
</script>

<div class="lg:col-span-2 card p-4 sm:p-6 space-y-4">
	<div class="flex items-center gap-3">
		<IconMapPin class="size-5 text-info-500" />
		<h2 class="text-lg font-semibold">{m.section_location()}</h2>
	</div>

	{#if geom3857?.coordinates && mapReady && addressMarkerLayer}
		<div
			bind:this={mapContainerEl}
			class="h-64 md:h-80 rounded-lg overflow-hidden border border-surface-200-800"
		>
			<Map
				variant="compact"
				layers={[...wmsLayers, ...(trenchLinesLayer ? [trenchLinesLayer] : []), addressMarkerLayer]}
				viewOptions={{
					center: mapCenter ?? undefined,
					zoom: 18
				}}
				showOpacitySlider={false}
				showLayerVisibilityTree={false}
				showSearchPanel={false}
			/>
		</div>
	{:else if geom3857?.coordinates}
		<div
			class="h-64 md:h-80 rounded-lg border border-surface-200-800 flex items-center justify-center animate-pulse"
		>
			<p class="text-sm text-surface-400">{m.common_loading()}</p>
		</div>
	{:else}
		<div
			class="h-64 md:h-80 rounded-lg border border-dashed border-surface-300-700 flex items-center justify-center"
		>
			<div class="text-center text-surface-400">
				<IconMapPin class="size-12 mx-auto mb-2 opacity-30" />
				<p class="text-sm font-medium text-surface-900-100">
					{m.message_no_location_data()}
				</p>
			</div>
		</div>
	{/if}

	{#if geom3857?.coordinates}
		<div
			class="flex items-start gap-2 text-xs text-surface-900-100 bg-surface-50-950 rounded px-3 py-2 flex-col"
		>
			<div class="flex items-center gap-2">
				<IconMapPin class="size-3.5 shrink-0" />
				<span class="font-mono">{coordsDefault}</span>
			</div>
			<div class="flex items-center gap-2">
				<IconMapPin class="size-3.5 shrink-0" />
				<span class="font-mono" {@attach tooltip(m.tooltip_coords_4326(), { position: 'bottom' })}>
					{coords4326}
				</span>
			</div>
		</div>
	{/if}

	<div class="border-t border-surface-200-800 pt-4">
		<AddressPdfDownload
			{uuid}
			{projectId}
			mapContainer={mapContainerEl}
			{coordsDefault}
			{coords4326}
		/>
	</div>
</div>
