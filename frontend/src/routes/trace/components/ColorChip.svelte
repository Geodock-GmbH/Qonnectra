<script lang="ts">
	import type { Snippet } from 'svelte';

	import { isLightColor } from '$lib/utils/colorContrast';

	const FALLBACK_HEX = '#64748b';

	interface Props {
		/** Background color of the chip; grey when missing. */
		hex?: string | null;
		/** Extra classes for size, padding and opacity. */
		class?: string;
		children: Snippet;
	}

	let { hex, class: className = '', children }: Props = $props();

	let background = $derived(hex || FALLBACK_HEX);
	let light = $derived(isLightColor(background));
</script>

<!--
	A light chip (white, yellow) gets dark text and an outline so neither the text
	nor the chip itself disappears on a light page.
-->
<span
	class={[
		'rounded font-medium',
		light ? 'text-surface-950 ring-1 ring-inset ring-surface-400-600' : 'text-white',
		className
	]}
	style:background
>
	{@render children()}
</span>
