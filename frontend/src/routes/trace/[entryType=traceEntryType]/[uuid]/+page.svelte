<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { traceEntryPath } from '$lib/utils/traceUtils';

	import TraceOutcome from '../../components/TraceOutcome.svelte';
	import { traceRequestFromPage } from '../../components/traceOptions';

	const request = $derived(traceRequestFromPage(page.params, page.url));

	/**
	 * Switches a fiber between the plain trace and the signal analysis. Leaving
	 * the analysis also drops its signal source.
	 * @param mode - The mode to switch to.
	 */
	function switchMode(mode: 'trace' | 'signal') {
		if (!request) return;
		const params = new URLSearchParams(page.url.searchParams);
		if (mode === 'signal') {
			params.set('mode', 'signal');
		} else {
			params.delete('mode');
			params.delete('source');
		}
		const path = traceEntryPath(request.entryType, request.entryId);
		goto(resolve(params.size > 0 ? `${path}?${params}` : path));
	}
</script>

{#if request}
	{#if request.entryType === 'fiber'}
		{@const mode = request.options.mode}
		<div class="mb-6 rounded-xl border border-surface-200-800 p-1.5">
			<div class="flex gap-1">
				<button
					type="button"
					class={[
						'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
						mode === 'trace'
							? 'bg-primary-500 text-white shadow-sm'
							: 'text-surface-600-400 hover:bg-surface-100-900 hover:text-surface-900-100'
					]}
					onclick={() => switchMode('trace')}
				>
					{m.trace_mode_standard()}
				</button>
				<button
					type="button"
					class={[
						'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
						mode === 'signal'
							? 'bg-warning-500 text-white shadow-sm'
							: 'text-surface-600-400 hover:bg-surface-100-900 hover:text-surface-900-100'
					]}
					onclick={() => switchMode('signal')}
				>
					{m.trace_mode_signal_analysis()}
				</button>
			</div>
		</div>
	{/if}

	{#key page.url.href}
		<QueryBoundary>
			<TraceOutcome {request} />
		</QueryBoundary>
	{/key}
{/if}
