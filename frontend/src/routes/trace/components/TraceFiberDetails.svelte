<script lang="ts">
	import type { FiberInfo } from '$lib/types/trace';

	import { m } from '$lib/paraglide/messages';

	import ColorChip from './ColorChip.svelte';

	interface Props {
		/** Fiber whose bundle, position, colors, layer, and status are shown. */
		fiber: FiberInfo;
	}

	let { fiber }: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-2 text-xs">
	{#if fiber.bundle_number !== null && fiber.bundle_number !== undefined}
		<span class="text-surface-900-100"
			>{m.form_bundle()}: <code class="text-surface-700-300">{fiber.bundle_number}</code></span
		>
	{/if}
	{#if fiber.fiber_number_in_bundle}
		<span class="text-surface-900-100"
			>{m.trace_in_bundle()}:
			<code class="text-surface-700-300">{fiber.fiber_number_in_bundle}</code></span
		>
	{/if}
	{#if fiber.fiber_color}
		<ColorChip hex={fiber.fiber_color_hex} class="px-1.5 py-0.5">{fiber.fiber_color}</ColorChip>
	{/if}
	{#if fiber.bundle_color}
		<ColorChip hex={fiber.bundle_color_hex} class="px-1.5 py-0.5 opacity-80">
			B: {fiber.bundle_color}
		</ColorChip>
	{/if}
	{#if fiber.layer}
		<span class="text-surface-900-100"
			>{m.form_layer()}: <code class="text-surface-700-300">{fiber.layer}</code></span
		>
	{/if}
	{#if fiber.status}
		<span class="rounded bg-surface-100-900 px-1.5 py-0.5 text-surface-900-100">{fiber.status}</span
		>
	{/if}
</div>
