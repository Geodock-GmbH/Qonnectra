<script>
	import { useSvelteFlow, Position, Handle } from '@xyflow/svelte';

	let { id, data } = $props();

	const trenches = $derived(data?.trenches || []);
	const handleCount = $derived(Math.max(1, trenches.length));
	const radius = $derived(Math.max(50, 30 + handleCount * 8));
	const diameter = $derived(radius * 2);

	const handlePositions = $derived(
		Array.from({ length: handleCount }, (_, i) => {
			// Position handles vertically in the center of the circle
			const x = radius; // Center horizontally
			const spacing = (diameter - 40) / (handleCount - 1); // Space between handles, leaving 20px margin on each end
			const y = 20 + i * spacing; // Start 20px from top, space evenly
			return { x, y };
		})
	);
</script>

<div
	class="relative bg-transparent rounded-full border-2 border-surface-200-700 shadow-lg"
	style="width: {diameter}px; height: {diameter}px;"
>
	{#each handlePositions as position, i}
		<Handle
			type={i === 0 ? 'target' : 'source'}
			position={Position.Top}
			id={`handle-${i}`}
			style="left: {position.x - 8}px; top: {position.y -
				8}px; position: absolute; transform: none;"
		/>
	{/each}
</div>
