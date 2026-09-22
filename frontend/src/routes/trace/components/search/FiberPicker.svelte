<script lang="ts">
	import type { TraceCable } from '$lib/types/trace';
	import { IconLoader2, IconPlug, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { getCableDetails } from '$lib/remote/network-schema/cables.remote';
	import { getFibersForCable } from '$lib/remote/network-schema/fibers.remote';

	import FiberBundles from './FiberBundles.svelte';
	import { getTraceSearchState } from './TraceSearchState.svelte';

	let { cableUuid }: { cableUuid: string } = $props();

	const search = getTraceSearchState();

	/**
	 * The cable's name and type for the heading. The URL only names the
	 * uuid, so the record is fetched; the fibers below load independently.
	 * @param uuid - The cable's uuid.
	 * @returns The cable, with its name and type when the backend knows them.
	 */
	async function cableOf(uuid: string): Promise<TraceCable> {
		return { ...(await getCableDetails(uuid)), uuid };
	}

	/**
	 * @param cable - The cable record.
	 * @returns The cable type's label, or undefined when it has none.
	 */
	function cableTypeLabel(cable: TraceCable): string | undefined {
		return typeof cable.cable_type === 'object' ? cable.cable_type?.cable_type : cable.cable_type;
	}
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
		<svelte:boundary>
			{@const cable = await cableOf(cableUuid)}
			{@const typeLabel = cableTypeLabel(cable)}
			<div class="font-medium text-surface-900-100">{cable.name}</div>
			{#if typeLabel}
				<div class="text-xs text-surface-600-400">{typeLabel}</div>
			{/if}

			{#snippet pending()}
				<div class="h-5 w-40 animate-pulse rounded bg-surface-200-800"></div>
			{/snippet}
			<!-- The bundle list below reports an unknown cable. -->
			{#snippet failed()}{/snippet}
		</svelte:boundary>
	</div>
	<svelte:boundary>
		<span class="text-sm text-surface-600-400">
			{(await getFibersForCable(cableUuid)).length}
			{m.form_fibers()}
		</span>

		{#snippet pending()}{/snippet}
		<!-- The bundle list below reports the failed lookup. -->
		{#snippet failed()}{/snippet}
	</svelte:boundary>
	<button
		type="button"
		onclick={() => search.clearCable()}
		class="rounded-full p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-700-300"
		title={m.action_change()}
	>
		<IconX size={18} />
	</button>
</div>

<QueryBoundary pending={loadingFibers}>
	<FiberBundles {cableUuid} />
</QueryBoundary>
