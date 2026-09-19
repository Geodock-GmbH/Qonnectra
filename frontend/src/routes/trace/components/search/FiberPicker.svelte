<script lang="ts">
	import type { TraceCable } from '$lib/types/trace';
	import { IconLoader2, IconPlug, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { getFibersForCable } from '$lib/remote/network-schema/fibers.remote';

	import FiberBundles from './FiberBundles.svelte';
	import { getTraceSearchState } from './TraceSearchState.svelte';

	let { cable }: { cable: TraceCable } = $props();

	const search = getTraceSearchState();

	const cableTypeLabel = $derived(
		typeof cable.cable_type === 'object' ? cable.cable_type?.cable_type : cable.cable_type
	);
</script>

{#snippet loadingFibers()}
	<div class="flex items-center justify-center py-8" role="status">
		<IconLoader2 size={24} class="animate-spin text-primary-500" />
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="mb-4 flex items-center gap-3 rounded-lg bg-surface-100-900 px-4 py-3">
	<IconPlug size={20} class="text-warning-500" />
	<div class="min-w-0 flex-1">
		<div class="font-medium text-surface-900-100">{cable.name}</div>
		{#if cableTypeLabel}
			<div class="text-xs text-surface-600-400">{cableTypeLabel}</div>
		{/if}
	</div>
	<svelte:boundary>
		<span class="text-sm text-surface-600-400">
			{(await getFibersForCable(cable.uuid)).length}
			{m.form_fibers()}
		</span>

		{#snippet pending()}{/snippet}
		<!-- The bundle list below reports the failed lookup. -->
		{#snippet failed()}{/snippet}
	</svelte:boundary>
	<button
		type="button"
		onclick={() => (search.selectedCable = null)}
		class="rounded-full p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-700-300"
		title={m.action_change()}
	>
		<IconX size={18} />
	</button>
</div>

<QueryBoundary pending={loadingFibers}>
	<FiberBundles cableUuid={cable.uuid} />
</QueryBoundary>
