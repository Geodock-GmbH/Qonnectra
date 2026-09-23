<script lang="ts">
	import type { SpliceInfo } from '$lib/types/trace';
	import { IconArrowsSplit } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	interface Props {
		/** Splice with its port, component placement, and container path. */
		splice: SpliceInfo;
	}

	let { splice }: Props = $props();
</script>

<div class="rounded-lg border border-secondary-500/30 bg-secondary-500/5 px-3 py-1.5 text-xs">
	<div class="mb-1 flex items-center gap-2 text-secondary-500">
		<IconArrowsSplit size={14} />
		<span class="font-semibold">{m.trace_splice()}</span>
		<code class="text-surface-600-400">{m.form_port()} {splice.port_number}</code>
	</div>
	{#if splice.component}
		<div class="flex flex-wrap gap-1.5">
			{#if splice.component.type}
				<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
					{splice.component.type}
				</span>
			{/if}
			{#if splice.component.slot_start !== null && splice.component.slot_end !== null}
				<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
					{m.form_slot({ count: 2 })}
					{splice.component.slot_start}-{splice.component.slot_end}
				</span>
			{/if}
			{#if splice.component.slot_side}
				<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
					{m.form_side()}: {splice.component.slot_side}
				</span>
			{/if}
			{#if splice.component.in_or_out}
				<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
					{splice.component.in_or_out}
				</span>
			{/if}
		</div>
	{/if}
	{#if splice.container_path && splice.container_path.length > 0}
		<div class="mt-1.5 text-xs">
			<span class="text-surface-600-400">{m.trace_container_path()}:</span>
			{#each splice.container_path as container, i (i)}
				{#if i > 0}<span class="mx-0.5 text-surface-500-400">→</span>{/if}
				<span class="rounded bg-surface-200-800 px-1 py-0.5 text-surface-600-400">
					{container.type}{container.name ? `: ${container.name}` : ''}
				</span>
			{/each}
		</div>
	{/if}
</div>
