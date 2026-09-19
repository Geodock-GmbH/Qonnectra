<script lang="ts">
	import type { TraceSearchResult } from '$lib/types/trace';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { m } from '$lib/paraglide/messages';

	import EntrySearch from './components/search/EntrySearch.svelte';
	import FiberPicker from './components/search/FiberPicker.svelte';
	import TraceSearchOptions from './components/search/TraceSearchOptions.svelte';
	import {
		setTraceSearchState,
		TraceSearchState
	} from './components/search/TraceSearchState.svelte';
	import TraceTypeTabs from './components/search/TraceTypeTabs.svelte';

	const search = setTraceSearchState(new TraceSearchState());

	/**
	 * Starts the trace of a search hit; on the fiber tab the hit is the cable
	 * whose fibers are offered next.
	 * @param result - The clicked search hit.
	 */
	function handleSelect(result: TraceSearchResult) {
		if (search.activeType === 'fiber') {
			search.selectedCable = result;
			return;
		}
		goto(resolve(search.tracePath(search.activeType, result.uuid)));
	}
</script>

<TraceTypeTabs />
<TraceSearchOptions />

<div class="rounded-xl border border-surface-200-800 p-3 sm:p-6">
	{#if search.selectedCable}
		<FiberPicker cable={search.selectedCable} />
	{:else}
		{#if search.activeType === 'fiber'}
			<div class="mb-2 text-sm text-surface-600-400">{m.trace_select_cable_first()}</div>
		{/if}
		{#key search.activeType}
			<EntrySearch onselect={handleSelect} />
		{/key}
	{/if}
</div>
