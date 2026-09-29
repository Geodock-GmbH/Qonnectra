<script lang="ts">
	import type { FiberInfo } from '$lib/types/trace';

	const FALLBACK_HEX = '#64748b';

	interface Props {
		/** Fiber whose fiber and bundle colors are shown as dots. */
		fiber: FiberInfo;
	}

	let { fiber }: Props = $props();
</script>

{#if fiber.fiber_color}
	<span
		class="inline-block h-2.5 w-2.5 rounded-full border border-surface-400-600"
		style:background={fiber.fiber_color_hex || FALLBACK_HEX}
		title={fiber.fiber_color}
	></span>
{/if}
{#if fiber.bundle_color}
	<span
		class="inline-block h-2.5 w-2.5 rounded-full border border-surface-400-600 opacity-70"
		style:background={fiber.bundle_color_hex || FALLBACK_HEX}
		title="B: {fiber.bundle_color}"
	></span>
{/if}
