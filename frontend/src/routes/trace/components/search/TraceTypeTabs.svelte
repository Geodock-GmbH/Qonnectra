<script lang="ts">
	import { TRACE_ENTRY_TYPES } from '$lib/remote/trace/trace-data';

	import { getTraceSearchState } from './TraceSearchState.svelte';
	import { TRACE_TYPE_DISPLAY } from './traceTypeDisplay';

	const search = getTraceSearchState();
</script>

<!-- Labels follow the bar's own width, not the viewport: five labels need ~650px, which a
     portrait tablet or a desktop with expanded sidebar does not leave. -->
<div class="@container mb-6 rounded-xl border border-surface-200-800 p-1.5 @2xl:p-2">
	<div class="flex gap-1 @2xl:gap-2">
		{#each TRACE_ENTRY_TYPES as type (type)}
			{@const display = TRACE_TYPE_DISPLAY[type]}
			{@const active = search.activeType === type}
			<button
				type="button"
				onclick={() => search.setActiveType(type)}
				class={[
					'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 transition-colors @2xl:px-4 @2xl:py-3',
					active ? 'bg-primary-500 text-white' : 'hover:bg-surface-100-900'
				]}
				title={display.label()}
			>
				<display.icon size={20} class="shrink-0 {active ? 'text-white' : display.color}" />
				<span class="hidden truncate text-sm font-medium @2xl:inline">{display.label()}</span>
			</button>
		{/each}
	</div>
</div>
