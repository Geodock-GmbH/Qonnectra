<script>
	import Map from '$lib/components/Map.svelte';
	import { m } from '$lib/paraglide/messages';
	import 'ol/ol.css';
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	const toaster = createToaster({
		placement: 'bottom-end'
	});

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// Extract features for clarity, handling potential undefined results if error occurred
	const features = data.trenches?.results?.features;

	// Trigger toast immediately on load if there's an error
	if (data.error) {
		toaster.create({
			type: 'error',
			message: m.error_loading_map_data(),
			description: data.error
		});
	}
</script>

<Toaster {toaster}></Toaster>

{#if data.error}
	<!-- pass -->
{:else if features}
	<div class="map-wrapper h-full w-full">
		<Map className="rounded-lg overflow-hidden" />
	</div>
{:else}
	<div class="p-4 text-yellow-700 bg-yellow-100 border border-yellow-400 rounded">
		<p>No map features found.</p>
	</div>
{/if}
