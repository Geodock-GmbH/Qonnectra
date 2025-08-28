<script>
	import { useSvelteFlow, Position, Handle } from '@xyflow/svelte';

	let { id, data } = $props();

	const trenches = $derived(data?.trenches || []);
	const handleCount = $derived(Math.max(12, trenches.length));
	const radius = $derived(Math.max(50, 30 + handleCount * 8));
	const diameter = $derived(radius * 2);

	const handlePositions = $derived(
		Array.from({ length: handleCount }, (_, i) => {
			const angle = (i / handleCount) * 2 * Math.PI - Math.PI / 2;
			const x = radius + Math.cos(angle) * (radius - 10);
			const y = radius + Math.sin(angle) * (radius - 10);
			return { x, y, angle };
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
