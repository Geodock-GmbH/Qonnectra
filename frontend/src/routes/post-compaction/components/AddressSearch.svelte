<script lang="ts">
	import { IconLoader2, IconSearch } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { debounce } from '$lib/map/searchUtils';

	import AddressSearchResults from './AddressSearchResults.svelte';

	let {
		projectId,
		onselect
	}: {
		projectId: string;
		onselect: (uuid: string) => void;
	} = $props();

	const MIN_SEARCH_LENGTH = 2;

	let searchQuery = $state('');
	let searchTerm = $state('');

	const applySearchTerm = debounce((value: string) => {
		searchTerm = value.trim();
	}, 300);

	function handleSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
		searchQuery = e.currentTarget.value;
		applySearchTerm(searchQuery);
	}
</script>

{#snippet searching()}
	<div class="mt-4 flex items-center justify-center py-4" role="status">
		<IconLoader2 size={20} class="text-primary-500 animate-spin" />
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="relative">
	<IconSearch size={20} class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500-400" />
	<input
		type="text"
		value={searchQuery}
		oninput={handleSearchInput}
		placeholder={m.pc_search_placeholder()}
		autocomplete="off"
		spellcheck="false"
		class="w-full rounded-lg border border-surface-200-800 bg-transparent py-3 pl-12 pr-4 text-surface-900-100 placeholder:text-surface-500-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
	/>
</div>

{#if searchTerm.length >= MIN_SEARCH_LENGTH}
	<QueryBoundary pending={searching} class="mt-2">
		<AddressSearchResults {searchTerm} {projectId} {onselect} />
	</QueryBoundary>
{:else}
	<div class="mt-4 py-4 text-center text-sm text-surface-600-400">
		{m.trace_search_hint()}
	</div>
{/if}
