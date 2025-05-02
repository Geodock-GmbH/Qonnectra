<script>
	import Map from '$lib/components/Map.svelte';
	import { m } from '$lib/paraglide/messages';
	import 'ol/ol.css';
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';
	import VectorSource from 'ol/source/Vector';
	import VectorLayer from 'ol/layer/Vector';
	import Fill from 'ol/style/Fill.js';
	import Stroke from 'ol/style/Stroke.js';
	import { GeoJSON } from 'ol/format';
	import { Style } from 'ol/style';
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// Extract features
	const features = data.trenches?.results?.features;

	const format = new GeoJSON();

	let vectorLayer = $state();

	if (features && features.length > 0) {
		try {
			const olFeatures = format.readFeatures(
				{
					type: 'FeatureCollection',
					features: features
				},
				{
					dataProjection: 'EPSG:3857',
					featureProjection: 'EPSG:3857'
				}
			);

			const vectorSource = new VectorSource({
				features: olFeatures
			});

			vectorLayer = new VectorLayer({
				source: vectorSource,
				style: new Style({
					fill: new Fill({
						color: 'rgba(255, 0, 0, 0.5)'
					}),
					stroke: new Stroke({
						color: 'rgba(255, 0, 0, 0.5)',
						width: 2
					})
				})
			});
		} catch (error) {
			toaster.create({
				type: 'error',
				message: m.error_loading_map_features(),
				description: m.error_loading_map_features_description()
			});
			vectorLayer = undefined;
		}
	} else {
		// No features available
		toaster.create({
			type: 'error',
			message: m.error_loading_map_features(),
			description: m.error_loading_map_features_no_features()
		});
		vectorLayer = undefined;
	}

	// Trigger toast immediately on load if there's an error
	if (data.error) {
		toaster.create({
			type: 'error',
			message: m.error_loading_map_features(),
			description: m.error_loading_map_features_description()
		});
	}
</script>

<Toaster {toaster}></Toaster>

{#if data.error}
	<!-- pass -->
{:else if features}
	<div class="map-wrapper h-full w-full">
		<Map className="rounded-lg overflow-hidden" layers={[vectorLayer]} />
	</div>
{:else}
	<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
		<p>No map features found.</p>
	</div>
{/if}
