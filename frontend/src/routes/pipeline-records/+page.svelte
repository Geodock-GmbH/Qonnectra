<script>
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { IconPlus } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import SearchInput from '$lib/components/SearchInput.svelte';

	import PipelineRecordsTable from './PipelineRecordsTable.svelte';

	let { data } = $props();
	let searchInput = $state('');

	const searchTerm = $derived(data.searchTerm || '');
	const pagination = $derived(data.pagination);

	$effect(() => {
		searchInput = searchTerm;
	});

	function performSearch() {
		const url = new URL($page.url);
		if (searchInput !== '') {
			url.searchParams.set('search', searchInput);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { keepFocus: true, noScroll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>{m.nav_pipeline_records()}</title>
</svelte:head>

<div class="relative flex gap-4 h-full overflow-hidden" data-testid="pipeline-records-page">
	<div
		class="flex-1 flex flex-col overflow-hidden h-full border-2 rounded-lg border-surface-200-800 p-4"
	>
		<div class="flex justify-between items-center">
			<div class="flex items-center">
				<nav
					class="btn-group md:preset-outlined-surface-200-800 flex-col justify-between items-start md:flex-row md:items-center md:justify-start md:gap-2"
				>
					<button
						class="btn preset-filled-primary-500"
						onclick={() => goto('/pipeline-records/new')}
					>
						<IconPlus class="size-4" />
						<span>{m.common_create()}</span>
					</button>
					<SearchInput bind:value={searchInput} onSearch={performSearch} />
				</nav>
			</div>
		</div>

		<div class="flex-1 min-h-0">
			{#if $navigating}
				<div class="table-wrap overflow-x-auto">
					<table class="table table-card caption-bottom w-full overflow-scroll">
						<thead>
							<tr>
								{#each { length: 5 } as _, i (i)}
									<td>
										<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
									</td>
								{/each}
							</tr>
						</thead>
					</table>
				</div>
			{:else}
				<PipelineRecordsTable records={data.records} {pagination} />
			{/if}
		</div>
	</div>
</div>
