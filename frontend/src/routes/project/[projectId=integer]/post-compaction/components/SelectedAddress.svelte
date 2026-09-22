<script lang="ts">
	import { IconMapPin, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import AddressLocationMap from '$lib/components/address/AddressLocationMap.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { getAddress } from '$lib/remote/address/addresses.remote';

	import PostCompactionExport from './PostCompactionExport.svelte';

	let {
		uuid,
		projectId,
		onclear
	}: {
		uuid: string;
		projectId: string;
		onclear: () => void;
	} = $props();

	const address = $derived(await getAddress(uuid));

	let mapContainer = $state<HTMLElement | null>(null);
</script>

{#snippet mapLoading()}
	<div
		class="max-w-md h-64 md:h-80 rounded-lg border border-surface-200-800 flex items-center justify-center animate-pulse"
		role="status"
	>
		<p class="text-sm text-surface-400">{m.common_loading()}</p>
	</div>
{/snippet}

<div class="flex items-center gap-3 rounded-lg bg-surface-100-900 px-4 py-3 mb-4">
	<IconMapPin size={20} class="text-error-500" />
	<div class="min-w-0 flex-1">
		<div class="font-medium text-surface-900-100">
			{address.street}
			{address.housenumber ?? ''}{address.house_number_suffix}
		</div>
		<div class="text-xs text-surface-600-400">
			{address.zip_code}
			{address.city}
			{#if address.district}
				· {address.district}
			{/if}
		</div>
	</div>
	<button
		type="button"
		onclick={onclear}
		aria-label={m.action_clear_selection()}
		class="rounded-full p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-700-300"
	>
		<IconX size={18} />
	</button>
</div>

<div class="space-y-4">
	<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
		<div>
			<span class="text-surface-500-400">{m.form_id_address({ count: 1 })}</span>
			<p class="font-mono font-medium">{address.id_address || '–'}</p>
		</div>
		<div>
			<span class="text-surface-500-400">{m.form_street()}</span>
			<p class="font-medium">{address.street || '–'}</p>
		</div>
		<div>
			<span class="text-surface-500-400">{m.form_housenumber()}</span>
			<p class="font-medium">
				{address.housenumber ?? '–'}{address.house_number_suffix}
			</p>
		</div>
		<div>
			<span class="text-surface-500-400">{m.form_zip_code()}</span>
			<p class="font-medium">{address.zip_code || '–'}</p>
		</div>
		<div>
			<span class="text-surface-500-400">{m.form_city()}</span>
			<p class="font-medium">{address.city || '–'}</p>
		</div>
		<div>
			<span class="text-surface-500-400">{m.form_district()}</span>
			<p class="font-medium">{address.district || '–'}</p>
		</div>
	</div>

	<QueryBoundary pending={mapLoading} class="max-w-md">
		<AddressLocationMap {uuid} {projectId} bind:container={mapContainer} class="max-w-md" />
	</QueryBoundary>

	<div class="border-t border-surface-200-800 pt-4">
		<QueryBoundary>
			<PostCompactionExport {uuid} {projectId} {mapContainer} />
		</QueryBoundary>
	</div>
</div>
