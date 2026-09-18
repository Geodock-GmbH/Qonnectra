<script lang="ts">
	import { slide } from 'svelte/transition';
	import { IconMapPin } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { formatAddressSearchResult } from '$lib/remote/post-compaction/address-search-data';
	import { searchAddresses } from '$lib/remote/post-compaction/address-search.remote';

	let {
		searchTerm,
		projectId,
		onselect
	}: {
		searchTerm: string;
		projectId: string;
		onselect: (uuid: string) => void;
	} = $props();

	const results = $derived(await searchAddresses({ searchQuery: searchTerm, projectId }));
</script>

{#if results.length > 0}
	<div
		class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-200-800"
		transition:slide={{ duration: 200 }}
	>
		{#each results as result (result.uuid)}
			<button
				type="button"
				onclick={() => onselect(result.uuid)}
				class="flex w-full items-center gap-3 border-b border-surface-100-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-100-900"
			>
				<IconMapPin size={18} class="text-error-500" />
				<div class="min-w-0 flex-1">
					<div class="truncate font-medium text-surface-900-100">
						{formatAddressSearchResult(result)}
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
{:else}
	<div class="mt-4 py-4 text-center text-surface-600-400" transition:slide={{ duration: 200 }}>
		{m.common_no_results()}
	</div>
{/if}
