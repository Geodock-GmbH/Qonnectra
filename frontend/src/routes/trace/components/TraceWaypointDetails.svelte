<script lang="ts">
	import type { FiberWaypoint } from '$lib/types/trace';
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import { IconChevronDown } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FiberColorDots from './FiberColorDots.svelte';
	import TraceFiberDetails from './TraceFiberDetails.svelte';
	import TraceSpliceDetails from './TraceSpliceDetails.svelte';

	interface Props {
		/** Waypoint whose cable ends, fiber colors and details are shown. */
		node: FiberWaypoint;
		/** Cards shown below the fiber and splice details while expanded. */
		details: Snippet;
	}

	let { node, details }: Props = $props();

	/** Whether the waypoint has anything beyond its fiber to show, which offers the details toggle. */
	const hasDetails = $derived(
		!!(
			node.splice ||
			node.endpoint_splices?.length ||
			node.cable_endpoints?.start_node ||
			node.cable_endpoints?.end_node ||
			node.node?.address ||
			node.residential_units?.length
		)
	);

	let expanded = $state(false);
</script>

<div class="flex flex-wrap items-center gap-x-2 gap-y-1 pl-0.5">
	{#if node.cable_endpoints}
		<span class="min-w-0 text-xs text-surface-500-400 wrap-anywhere">
			{node.cable_endpoints.start_node?.name || '?'}
			<span class="mx-0.5">↔</span>
			{node.cable_endpoints.end_node?.name || '?'}
		</span>
	{/if}
	<FiberColorDots fiber={node.fiber} />
	{#if hasDetails}
		<button
			type="button"
			class="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-surface-500-400 transition-colors hover:bg-surface-100-900 hover:text-surface-700-300"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			<span>{m.trace_details()}</span>
			<IconChevronDown size={14} class="transition-transform {expanded ? 'rotate-180' : ''}" />
		</button>
	{/if}
</div>

{#if hasDetails && expanded}
	<div class="mt-2 space-y-2 pl-0.5" transition:slide={{ duration: 150 }}>
		<TraceFiberDetails fiber={node.fiber} />
		{#if node.splice}
			<TraceSpliceDetails splice={node.splice} />
		{/if}
		{@render details()}
	</div>
{/if}
