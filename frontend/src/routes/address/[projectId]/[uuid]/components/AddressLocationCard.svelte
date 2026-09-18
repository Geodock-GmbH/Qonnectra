<script lang="ts">
	import { page } from '$app/state';
	import { IconMapPin } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import AddressLocationMap from '$lib/components/address/AddressLocationMap.svelte';
	import { formatLatLon, formatStorageCoordinates } from '$lib/map/projectionUtils';
	import { tooltip } from '$lib/utils/tooltip';
	import { getAddress } from '$lib/remote/address/addresses.remote';

	import AddressPdfDownload from './AddressPdfDownload.svelte';

	let { uuid, projectId }: { uuid: string; projectId: string } = $props();

	const address = $derived(await getAddress(uuid));
	const coordinates = $derived(address.geom_3857?.coordinates);

	let mapContainerEl = $state<HTMLElement | null>(null);

	const coords4326 = $derived(coordinates ? formatLatLon(coordinates) : null);
	const coordsDefault = $derived(
		coordinates ? formatStorageCoordinates(coordinates, page.data.srid, page.data.proj4Def) : null
	);
</script>

<div class="lg:col-span-2 card p-4 sm:p-6 space-y-4">
	<div class="flex items-center gap-3">
		<IconMapPin class="size-5 text-info-500" />
		<h2 class="text-lg font-semibold">{m.section_location()}</h2>
	</div>

	<AddressLocationMap {uuid} {projectId} bind:container={mapContainerEl} />

	{#if coordinates}
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
