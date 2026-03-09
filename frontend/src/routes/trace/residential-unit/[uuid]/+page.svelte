<script>
	import { fly } from 'svelte/transition';

	import TraceResults from '../../components/TraceResults.svelte';

	let { data } = $props();
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
	/>
{/if}
