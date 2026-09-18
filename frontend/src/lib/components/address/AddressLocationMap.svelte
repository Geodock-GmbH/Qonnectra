<script lang="ts">
	import 'ol/ol.css';

	import { onMount } from 'svelte';
	import { IconMapPin } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import Map from '$lib/components/Map.svelte';
	import { createAddressStyle, createTrenchStyle } from '$lib/map/styles';
	import {
		getWMSLayerVisibility,
		trenchColor,
		wmsLayerVisibilityConfig,
		wmsSourcesData
	} from '$lib/stores/store';
	import { fetchWMSAccessToken, fetchWMSSources, getWMSProxyUrl } from '$lib/utils/wmsApi';
	import { createWMSLayer } from '$lib/map';
	import { getAddress, getLinkedTrenches } from '$lib/remote/address/addresses.remote';

	let {
		uuid,
		projectId,
		container = $bindable(null),
		class: className = ''
	}: {
		uuid: string;
		projectId: string;
		/** The rendered map's element, for capturing its canvases into a PDF. */
		container?: HTMLElement | null;
		class?: string;
	} = $props();

	const loaded = $derived(await Promise.all([getAddress(uuid), getLinkedTrenches(uuid)]));
	const coordinates = $derived(loaded[0].geom_3857?.coordinates);
	const linkedTrenchGeometries = $derived(loaded[1]);

	let addressMarkerLayer = $state<import('ol/layer/Vector').default | null>(null);
	let trenchLinesLayer = $state<import('ol/layer/Vector').default | null>(null);
	let wmsLayers = $state<import('ol/layer/Base').default[]>([]);

	/**
	 * Loads the project's enabled WMS layers with their saved visibility.
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
			console.warn('Failed to load WMS layers for the address map:', error);
		}
	}

	onMount(async () => {
		if (!coordinates) return;
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

		const geoJsonFormat = new GeoJSON();
		const trenchFeatures = linkedTrenchGeometries
			.filter((feature) => feature.geometry)
			.flatMap((feature) =>
				geoJsonFormat.readFeatures(feature, {
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

		await loadWMSLayers();

		addressMarkerLayer = new VectorLayer({
			source: new VectorSource({
				features: [new Feature({ geometry: new Point(coordinates) })]
			}),
			style: createAddressStyle(),
			zIndex: 100,
			properties: { layerId: 'address-marker' }
		});
	});
</script>

{#if coordinates && addressMarkerLayer}
	<div
		bind:this={container}
		class={['h-64 md:h-80 rounded-lg overflow-hidden border border-surface-200-800', className]}
	>
		<Map
			variant="compact"
			layers={[...wmsLayers, ...(trenchLinesLayer ? [trenchLinesLayer] : []), addressMarkerLayer]}
			viewOptions={{ center: coordinates, zoom: 18 }}
			showOpacitySlider={false}
			showLayerVisibilityTree={false}
			showSearchPanel={false}
		/>
	</div>
{:else if coordinates}
	<div
		class={[
			'h-64 md:h-80 rounded-lg border border-surface-200-800 flex items-center justify-center animate-pulse',
			className
		]}
		role="status"
	>
		<p class="text-sm text-surface-400">{m.common_loading()}</p>
	</div>
{:else}
	<div
		class={[
			'h-64 md:h-80 rounded-lg border border-dashed border-surface-300-700 flex items-center justify-center',
			className
		]}
	>
		<div class="text-center text-surface-400">
			<IconMapPin class="size-12 mx-auto mb-2 opacity-30" />
			<p class="text-sm font-medium text-surface-900-100">
				{m.message_no_location_data()}
			</p>
		</div>
	</div>
{/if}
