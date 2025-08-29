<script>
	import { Position, Handle } from '@xyflow/svelte';

	let { id, data } = $props();

	const trench = $derived(data?.trench || null);
	const totalMicroducts = $derived(data?.totalMicroducts || 0);
	const nodeName = $derived(data?.nodeName || '');
	const handleCount = $derived(Math.max(1, totalMicroducts));
	const radius = $derived(Math.max(60, 40 + handleCount * 3));
	const diameter = $derived(radius * 2);

	// Create handle data with microduct information
	const handleData = $derived(() => {
		if (!trench || !trench.conduits) return [];
		
		const handles = [];
		trench.conduits.forEach((conduit, conduitIndex) => {
			conduit.microducts.forEach((microduct, micIndex) => {
				handles.push({
					id: `trench-${trench.uuid}-conduit-${conduitIndex}-microduct-${microduct.number}`,
					microductUuid: microduct.uuid,
					microductNumber: microduct.number,
					conduitName: conduit.name,
					conduitUuid: conduit.uuid,
					status: microduct.microduct_status
				});
			});
		});
		return handles;
	});

	const handlePositions = $derived(
		handleData().map((handle, i) => {
			const x = radius; // Center horizontally
			const spacing = handleCount > 1 ? (diameter - 40) / (handleCount - 1) : 0;
			const y = 20 + i * spacing;
			return { 
				x, 
				y, 
				handle: handle 
			};
		})
	);
</script>

<div
	class="relative bg-surface-50-950 rounded-full border-2 border-surface-200-700 shadow-lg flex items-center justify-center"
	style="width: {diameter}px; height: {diameter}px;"
>
	<!-- Node label -->
	<div class="absolute top-2 left-2 text-xs font-semibold text-surface-600-300 z-10">
		{trench?.id_trench || 'N/A'}
	</div>
	
	<!-- Node center content -->
	<div class="text-center text-xs font-medium text-surface-700-200">
		<div class="font-semibold">{nodeName}</div>
		<div class="text-xs opacity-70">{totalMicroducts} microducts</div>
	</div>

	{#each handlePositions as position, i}
		<Handle
			type={i === 0 ? 'target' : 'source'}
			position={Position.Top}
			id={position.handle.id}
			style="left: {position.x - 8}px; top: {position.y - 8}px; position: absolute; transform: none; background-color: {position.handle.status ? 'var(--color-success-500)' : 'var(--color-surface-400)'};"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber}"
		/>
	{/each}
</div>
