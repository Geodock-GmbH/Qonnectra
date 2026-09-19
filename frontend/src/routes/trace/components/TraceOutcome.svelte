<script lang="ts">
	import type { TraceRequest } from './traceOptions';

	import SignalAnalysis from './SignalAnalysis.svelte';
	import TraceResults from './TraceResults.svelte';
	import { getTraceSelection } from './TraceSelection.svelte';
	import { traceQuery } from './traceOptions';

	let { request }: { request: TraceRequest } = $props();

	const selection = getTraceSelection();

	/** Only a fiber's trace is drawn on the map, so only its items can be highlighted. */
	const highlights = $derived(request.entryType === 'fiber');

	const result = $derived(await traceQuery(request));
</script>

{#if request.options.mode === 'signal'}
	<SignalAnalysis
		{result}
		entryId={request.entryId}
		includeGeometry={request.options.includeGeometry}
		selectedItemId={selection.featureId}
		onItemSelect={selection.selectItem}
	/>
{:else}
	<TraceResults
		{result}
		entryType={request.entryType}
		entryId={request.entryId}
		includeGeometry={request.options.includeGeometry}
		selectedItemId={highlights ? selection.featureId : null}
		onItemSelect={highlights ? selection.selectItem : undefined}
	/>
{/if}
