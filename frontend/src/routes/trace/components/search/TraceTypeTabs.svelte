<script lang="ts">
	import { TRACE_ENTRY_TYPES } from '$lib/remote/trace/trace-data';

	import { getTraceSearchState } from './TraceSearchState.svelte';
	import { TRACE_TYPE_DISPLAY } from './traceTypeDisplay';

	const search = getTraceSearchState();
</script>

<div class="mb-6 rounded-xl border border-surface-200-800 p-1.5 sm:p-2">
	<div class="flex gap-1 sm:gap-2">
		{#each TRACE_ENTRY_TYPES as type (type)}
			{@const display = TRACE_TYPE_DISPLAY[type]}
			{@const active = search.activeType === type}
			<button
				type="button"
				onclick={() => search.setActiveType(type)}
				class={[
					'flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 transition-colors sm:px-4 sm:py-3',
					active ? 'bg-primary-500 text-white' : 'hover:bg-surface-100-900'
				]}
				title={display.label()}
			>
				<display.icon size={20} class={active ? 'text-white' : display.color} />
				<span class="hidden text-sm font-medium sm:inline">{display.label()}</span>
			</button>
		{/each}
	</div>
</div>
