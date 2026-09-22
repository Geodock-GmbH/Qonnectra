<script lang="ts">
	import { IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import AddressSearch from './AddressSearch.svelte';
	import SelectedAddress from './SelectedAddress.svelte';

	let { projectId }: { projectId: string } = $props();

	let selectedUuid = $state<string | null>(null);
</script>

{#snippet addressLoading()}
	<div class="flex items-center justify-center py-12" role="status">
		<IconLoader2 size={28} class="text-primary-500 animate-spin" />
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

{#if selectedUuid}
	<QueryBoundary pending={addressLoading}>
		<SelectedAddress uuid={selectedUuid} {projectId} onclear={() => (selectedUuid = null)} />
	</QueryBoundary>
{:else}
	<AddressSearch {projectId} onselect={(uuid) => (selectedUuid = uuid)} />
{/if}
