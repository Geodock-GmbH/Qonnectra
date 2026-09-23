<script lang="ts">
	import type { FiberInfo } from '$lib/types/trace';

	import { m } from '$lib/paraglide/messages';

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
		<span
			class="rounded px-1.5 py-0.5 font-medium text-white"
			style="background: {fiber.fiber_color_hex || '#64748b'}"
		>
			{fiber.fiber_color}
		</span>
	{/if}
	{#if fiber.bundle_color}
		<span
			class="rounded px-1.5 py-0.5 font-medium text-white opacity-80"
			style="background: {fiber.bundle_color_hex || '#64748b'}"
		>
			B: {fiber.bundle_color}
		</span>
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
