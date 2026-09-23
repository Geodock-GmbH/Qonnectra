<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { DEFAULT_PAGE_SIZE, queryInt, queryString, setQuery } from '$lib/utils/urlState';
	import { routeProjectId } from '$lib/context/project';
	import { getAddressList } from '$lib/remote/address/addresses.remote';

	import AddressTable from './components/AddressTable.svelte';

	const projectId = $derived(routeProjectId());
	const searchTerm = $derived(queryString(page.url, 'search'));
	const currentPage = $derived(queryInt(page.url, 'page', 1, { min: 1 }));
	const pageSize = $derived(queryInt(page.url, 'page_size', DEFAULT_PAGE_SIZE, { min: 1 }));

	// Follows the URL (back/forward, reload) but stays editable until submitted.
	let searchInput = $derived(searchTerm);

	/**
	 * Applies the search input and returns to the first page.
	 */
	function performSearch() {
		setQuery({ search: searchInput, page: 1 });
	}
</script>

<svelte:head>
	<title>{m.nav_address()}</title>
</svelte:head>

{#snippet tableSkeleton()}
	<div class="table-wrap overflow-x-auto" role="status">
		<table class="table table-card caption-bottom w-full overflow-scroll">
			<thead>
				<tr>
					{#each { length: 8 }, i (i)}
						<td>
							<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
						</td>
					{/each}
				</tr>
			</thead>
		</table>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="relative flex gap-4 h-full overflow-hidden">
	<div
		class="flex-1 flex flex-col overflow-hidden h-full border-2 rounded-lg border-surface-200-800 p-4"
	>
		<div class="flex justify-between items-center mb-4">
			<div class="flex items-center">
				<nav
					class="btn-group md:preset-outlined-surface-200-800 flex-col justify-between items-start md:flex-row md:items-center md:justify-start md:gap-2"
				>
					<SearchInput bind:value={searchInput} onSearch={performSearch} />
				</nav>
			</div>
		</div>

		<div class="flex-1 min-h-0">
			<QueryBoundary pending={tableSkeleton}>
				{@const list = await getAddressList({
					projectId,
					search: searchTerm,
					page: currentPage,
					pageSize
				})}
				<div
					class={[
						'h-full transition-opacity',
						$effect.pending() > 0 && 'opacity-60 pointer-events-none'
					]}
				>
					<AddressTable addresses={list.addresses} pagination={list.pagination} />
				</div>
			</QueryBoundary>
		</div>
	</div>
</div>
