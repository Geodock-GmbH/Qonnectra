<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { getAddressList } from '$lib/remote/address/addresses.remote';

	import AddressTable from './components/AddressTable.svelte';

	const projectId = $derived(page.params.projectId ?? '');
	const searchTerm = $derived(page.url.searchParams.get('search') ?? '');
	const currentPage = $derived(Number(page.url.searchParams.get('page')) || 1);
	const pageSize = $derived(Number(page.url.searchParams.get('page_size')) || 50);

	// Follows the URL (back/forward, reload) but stays editable until submitted.
	let searchInput = $derived(searchTerm);

	/**
	 * Navigates to page 1 with the current search input as a query parameter.
	 */
	function performSearch() {
		const url = new URL(page.url);
		if (searchInput !== '') {
			url.searchParams.set('search', searchInput);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1');
		goto(url, { keepFocus: true, noScroll: true, replaceState: true });
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
					{#each { length: 8 } as _, i (i)}
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
