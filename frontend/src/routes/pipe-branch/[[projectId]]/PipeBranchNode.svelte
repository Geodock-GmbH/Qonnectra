<script>
	import { useSvelteFlow, Position } from '@xyflow/svelte';

	let { id, data } = $props();

	const radius = 70;
</script>

<div
	class="relative w-36 h-36 bg-surface-500 rounded-full border-2 border-surface-200-700 shadow-lg"
	style="width: {radius * 2}px; height: {radius * 2}px;"
></div>
