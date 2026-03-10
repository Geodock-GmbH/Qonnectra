<script>
	import { fly } from 'svelte/transition';

	import TraceResults from '../../components/TraceResults.svelte';
	import { getTraceMapContext } from '../../traceMapContext.svelte.js';

	let { data } = $props();

	const traceMapContext = getTraceMapContext();

	$effect(() => {
		traceMapContext.traceResult = data.result;
		traceMapContext.includeGeometry = data.options?.includeGeometry ?? false;
	});
</script>

{#if data.error}
	<div
		class="flex items-center gap-3 rounded-lg border border-error-500/30 bg-error-500/10 px-4 py-3"
		transition:fly={{ y: -20, duration: 300 }}
	>
		<span
			class="flex h-6 w-6 items-center justify-center rounded-full bg-error-500 text-sm font-bold text-white"
		>
			!
		</span>
		<div>
			<span class="text-error-500">{data.error}</span>
			<code class="ml-2 text-xs text-surface-600-400">{data.entryId}</code>
		</div>
	</div>
{:else if data.result}
	<TraceResults
		result={data.result}
		entryType={data.entryType}
		entryId={data.entryId}
		includeGeometry={data.options?.includeGeometry}
		selectedItemId={traceMapContext.selectedFeatureId}
		onItemSelect={(type, id) => traceMapContext.setSelectedFeature(`${type}:${id}`)}
	/>
{/if}
