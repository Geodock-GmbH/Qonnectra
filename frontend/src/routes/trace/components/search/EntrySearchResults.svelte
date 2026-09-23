<script lang="ts">
	import type { TraceSearchResult } from '$lib/types/trace';
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import { defaultProject } from '$lib/utils/rememberedProject';
	import { getRememberedProject } from '$lib/context/rememberedProject.svelte';
	import { searchTraceEntries } from '$lib/remote/trace/trace-search.remote';

	import { getTraceSearchState } from './TraceSearchState.svelte';
	import { searchResultLabel, searchResultSubtitle } from './searchResultLabels';
	import { TRACE_TYPE_DISPLAY } from './traceTypeDisplay';

	let {
		searchTerm,
		onselect
	}: {
		searchTerm: string;
		onselect: (result: TraceSearchResult) => void;
	} = $props();

	const search = getTraceSearchState();
	const remembered = getRememberedProject();

	/**
	 * The project searched on this global page, defaulting to the remembered
	 * one. Live, so picking another project in the app bar re-runs the search
	 * without a navigation.
	 */
	const projectId = $derived(defaultProject(remembered.id, page.data.projects ?? [])?.value ?? '');

	const display = $derived(TRACE_TYPE_DISPLAY[search.searchType]);

	const results = $derived(
		await searchTraceEntries({
			searchQuery: searchTerm,
			type: search.searchType,
			projectId: search.globalSearch ? '' : projectId
		})
	);
</script>

{#if results.length > 0}
	<div
		class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-200-800"
		transition:slide={{ duration: 200 }}
	>
		{#each results as result (result.uuid)}
			{@const subtitle = searchResultSubtitle(search.searchType, result)}
			<button
				type="button"
				onclick={() => onselect(result)}
				class="flex w-full items-center gap-3 border-b border-surface-100-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-100-900"
			>
				<display.icon size={18} class={display.color} />
				<div class="min-w-0 flex-1">
					<div class="truncate font-medium text-surface-900-100">
						{searchResultLabel(search.searchType, result)}
					</div>
					{#if subtitle}
						<div class="truncate text-xs text-surface-600-400">{subtitle}</div>
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
