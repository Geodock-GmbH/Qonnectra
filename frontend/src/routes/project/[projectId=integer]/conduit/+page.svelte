<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import Drawer from '$lib/components/Drawer.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		closeFeature,
		DEFAULT_PAGE_SIZE,
		queryFeature,
		queryInt,
		queryString,
		setQuery
	} from '$lib/utils/urlState';
	import { routeProjectId } from '$lib/context/project';
	import { getConduitList } from '$lib/remote/conduit/conduits.remote';

	import ConduitImportControls from './components/ConduitImportControls.svelte';
	import ConduitDrawerTabs from './components/drawer/ConduitDrawerTabs.svelte';
	import PipeModal from './components/PipeModal.svelte';
	import PipeTable from './components/PipeTable.svelte';

	const projectId = $derived(routeProjectId());
	const searchTerm = $derived(queryString(page.url, 'search'));
	const currentPage = $derived(queryInt(page.url, 'page', 1, { min: 1 }));
	const pageSize = $derived(queryInt(page.url, 'page_size', DEFAULT_PAGE_SIZE, { min: 1 }));

	/** Feature kinds this page can show in the drawer. */
	const DRAWER_KINDS = ['conduit'] as const;

	// `?feature=conduit:<uuid>` is the drawer: present means open with that conduit.
	const feature = $derived(queryFeature(page.url, DRAWER_KINDS));
	let drawerTitle = $state('');

	// Follows the URL (back/forward, reload) but stays editable until submitted.
	let searchInput = $derived(searchTerm);
	let openPipeModal = $state(false);

	/**
	 * Applies the search input and returns to the first page.
	 */
	function performSearch() {
		setQuery({ search: searchInput, page: 1 });
	}
</script>

<svelte:head>
	<title>{m.nav_conduit_management()}</title>
</svelte:head>

{#snippet tableSkeleton()}
	<div class="table-wrap overflow-x-auto" role="status">
		<table class="table table-card caption-bottom w-full overflow-scroll">
			<thead>
				<tr>
					{#each { length: 10 }, i (i)}
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

{#snippet addButtonSkeleton()}
	<div class="placeholder animate-pulse h-10 w-32 rounded" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="relative flex gap-4 h-full overflow-hidden" data-testid="conduit-page">
	<div
		class="flex-1 flex flex-col overflow-hidden h-full border-2 rounded-lg border-surface-200-800 p-4"
	>
		<div class="flex justify-between items-center">
			<div class="flex items-center">
				<nav
					class="btn-group md:preset-outlined-surface-200-800 flex-col justify-between items-start md:flex-row md:items-center md:justify-start md:gap-2"
				>
					<QueryBoundary pending={addButtonSkeleton}>
						<PipeModal {projectId} bind:openPipeModal />
					</QueryBoundary>
					<SearchInput bind:value={searchInput} onSearch={performSearch} />
				</nav>
			</div>

			<div class="hidden md:flex justify-end">
				<ConduitImportControls />
			</div>
		</div>

		<div class="flex-1 min-h-0">
			<QueryBoundary pending={tableSkeleton}>
				{@const list = await getConduitList({
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
					<PipeTable
						pipes={list.conduits}
						pagination={list.pagination}
						selectedUuid={feature?.id ?? null}
					/>
				</div>
			</QueryBoundary>
		</div>
	</div>

	<Drawer open={feature !== null} title={feature ? drawerTitle : ''} onclose={closeFeature}>
		{#if feature}
			{#key feature.id}
				<QueryBoundary>
					<ConduitDrawerTabs uuid={feature.id} bind:title={drawerTitle} />
				</QueryBoundary>
			{/key}
		{/if}
	</Drawer>
</div>
