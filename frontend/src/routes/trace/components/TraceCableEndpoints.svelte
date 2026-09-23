<script lang="ts">
	import type { FiberPathNode } from '$lib/types/trace';

	import { m } from '$lib/paraglide/messages';

	import { traceFrom } from '$lib/utils/traceUtils';

	interface Props {
		/** Start/end nodes (and their addresses) of the cable being traversed. */
		endpoints: NonNullable<FiberPathNode['cable_endpoints']>;
		/** Node the trace is currently at; its endpoint is highlighted. */
		currentNodeId: string | undefined;
	}

	let { endpoints, currentNodeId }: Props = $props();
</script>

<div class="rounded-lg border border-primary-500/30 bg-primary-500/5 px-3 py-1.5 text-xs">
	<div class="mb-1 font-semibold text-primary-500">
		{m.trace_cable_path()}: {endpoints.cable_name}
	</div>
	<div class="flex flex-wrap items-center gap-2">
		{#if endpoints.start_node}
			<div class="flex items-center gap-1">
				<span class="text-xs uppercase text-surface-600-400">{m.trace_start()}</span>
				<button
					type="button"
					class="rounded px-1.5 py-0.5 font-mono text-xs {endpoints.start_node.id === currentNodeId
						? 'bg-primary-500/20 text-primary-500'
						: 'bg-surface-200-800 text-surface-900-100'} hover:bg-surface-300-700"
					onclick={() => traceFrom('node', endpoints.start_node?.id ?? '')}
				>
					{endpoints.start_node.name || m.common_unknown()}
				</button>
				{#if endpoints.start_node.type}
					<span class="text-xs text-surface-600-400">{endpoints.start_node.type}</span>
				{/if}
			</div>
		{:else}
			<span class="text-xs text-surface-600-400">{m.trace_start_not_set()}</span>
		{/if}

		<span class="text-surface-500-400">↔</span>

		{#if endpoints.end_node}
			<div class="flex items-center gap-1">
				<span class="text-xs uppercase text-surface-600-400">{m.trace_end()}</span>
				<button
					type="button"
					class="rounded px-1.5 py-0.5 font-mono text-xs {endpoints.end_node.id === currentNodeId
						? 'bg-primary-500/20 text-primary-500'
						: 'bg-surface-200-800 text-surface-900-100'} hover:bg-surface-300-700"
					onclick={() => traceFrom('node', endpoints.end_node?.id ?? '')}
				>
					{endpoints.end_node.name || m.common_unknown()}
				</button>
				{#if endpoints.end_node.type}
					<span class="text-xs text-surface-600-400">{endpoints.end_node.type}</span>
				{/if}
			</div>
		{:else}
			<span class="text-xs text-surface-600-400">{m.trace_end_not_set()}</span>
		{/if}
	</div>

	{#if endpoints.start_node?.address || endpoints.end_node?.address}
		<div class="mt-1.5 text-xs">
			{#if endpoints.start_node?.address}
				<div class="mb-0.5">
					<span class="text-surface-600-400">{m.trace_start_address()}</span>
					<button
						type="button"
						class="underline decoration-surface-300-700 underline-offset-2 text-surface-900-100 hover:text-primary-500 hover:decoration-primary-500"
						onclick={() => traceFrom('address', endpoints.start_node?.address?.id ?? '')}
					>
						{endpoints.start_node.address.street}
						{endpoints.start_node.address.housenumber}{endpoints.start_node.address.suffix || ''},
						{endpoints.start_node.address.zip_code}
						{endpoints.start_node.address.city}
					</button>
				</div>
			{/if}
			{#if endpoints.end_node?.address}
				<div>
					<span class="text-surface-600-400">{m.trace_end_address()}</span>
					<button
						type="button"
						class="underline decoration-surface-300-700 underline-offset-2 text-surface-900-100 hover:text-primary-500 hover:decoration-primary-500"
						onclick={() => traceFrom('address', endpoints.end_node?.address?.id ?? '')}
					>
						{endpoints.end_node.address.street}
						{endpoints.end_node.address.housenumber}{endpoints.end_node.address.suffix || ''},
						{endpoints.end_node.address.zip_code}
						{endpoints.end_node.address.city}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
