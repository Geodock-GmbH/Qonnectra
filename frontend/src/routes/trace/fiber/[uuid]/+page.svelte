<script>
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import * as m from '$lib/paraglide/messages.js';

	import SignalAnalysis from '../../components/SignalAnalysis.svelte';
	import TraceResults from '../../components/TraceResults.svelte';
	import { getTraceMapContext } from '../../traceMapContext.svelte.js';

	let { data } = $props();

	const traceMapContext = getTraceMapContext();
	const mode = $derived(data.mode || 'trace');

	$effect(() => {
		traceMapContext.traceResult = data.result;
		traceMapContext.includeGeometry = data.options?.includeGeometry ?? false;
	});

	function switchMode(newMode) {
		const url = new URL(page.url);
		if (newMode === 'signal') {
			url.searchParams.set('mode', 'signal');
		} else {
			url.searchParams.delete('mode');
			url.searchParams.delete('source');
		}
		goto(url.toString());
	}
</script>

<!-- Mode Toggle -->
<div class="mb-6 rounded-xl border border-surface-200-800 p-1.5">
	<div class="flex gap-1">
		<button
			type="button"
			class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all {mode === 'trace'
				? 'bg-primary-500 text-white shadow-sm'
				: 'text-surface-600-400 hover:bg-surface-100-900 hover:text-surface-900-100'}"
			onclick={() => switchMode('trace')}
		>
			{m.trace_mode_standard()}
		</button>
		<button
			type="button"
			class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all {mode === 'signal'
				? 'bg-warning-500 text-white shadow-sm'
				: 'text-surface-600-400 hover:bg-surface-100-900 hover:text-surface-900-100'}"
			onclick={() => switchMode('signal')}
		>
			{m.trace_mode_signal_analysis()}
		</button>
	</div>
</div>

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
	{#if mode === 'signal'}
		<SignalAnalysis
			result={data.result}
			entryId={data.entryId}
			includeGeometry={data.options?.includeGeometry}
			selectedItemId={traceMapContext.selectedFeatureId}
			onItemSelect={(type, id) => traceMapContext.setSelectedFeature(`${type}:${id}`)}
		/>
	{:else}
		<TraceResults
			result={data.result}
			entryType={data.entryType}
			entryId={data.entryId}
			includeGeometry={data.options?.includeGeometry}
			selectedItemId={traceMapContext.selectedFeatureId}
			onItemSelect={(type, id) => traceMapContext.setSelectedFeature(`${type}:${id}`)}
		/>
	{/if}
{/if}
