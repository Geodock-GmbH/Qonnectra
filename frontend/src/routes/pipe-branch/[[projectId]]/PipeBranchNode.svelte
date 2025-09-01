<script>
	// Skeleton
	import { createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// SvelteFlow
	import { Position, Handle } from '@xyflow/svelte';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { id, data } = $props();

	const trench = $derived(data?.trench || null);
	const conduit = $derived(data?.conduit || null);
	const totalMicroducts = $derived(data?.totalMicroducts || 0);
	const nodeName = $derived(data?.nodeName || '');
	const handleCount = $derived(Math.max(1, totalMicroducts));
	const radius = $derived(Math.max(60, 40 + handleCount * 3));
	const diameter = $derived(radius * 2);

	const handleData = $derived(() => {
		if (!conduit || !conduit.microducts) return [];

		const handles = [];
		conduit.microducts.forEach((microduct, micIndex) => {
			handles.push({
				id: `conduit-${conduit.uuid}-microduct-${microduct.number}`,
				microductUuid: microduct.uuid,
				microductNumber: microduct.number,
				conduitName: conduit.name,
				conduitUuid: conduit.uuid,
				status: microduct.microduct_status
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

<Toaster {toaster}></Toaster>

<!-- Node label and content box positioned above and to the left -->
<div
	class="absolute top-0 left-0 bg-surface-50-950 border border-surface-200-700 rounded-lg shadow-md p-2 min-w-[120px] max-w-[250px]"
	style="transform: translate(-100%, -100%);"
>
	<div class="flex flex-col gap-1">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold text-surface-600-300 whitespace-nowrap"
				>{m.id_trench()}:</span
			>
			<span class="font-semibold text-xs text-surface-600-300 break-words"
				>{trench?.id_trench || 'N/A'}</span
			>
		</div>
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold text-surface-700-200 whitespace-nowrap"
					>{m.conduit()}:</span
				>
				<span class="font-semibold text-xs text-surface-700-200 break-words"
					>{conduit?.name || 'N/A'}</span
				>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold text-surface-700-200 whitespace-nowrap"
					>{totalMicroducts}x {totalMicroducts > 1 ? m.microducts() : m.microduct()}</span
				>
			</div>
		</div>
	</div>
</div>

<!-- Node handles -->
<div
	class="relative bg-surface-50-950 rounded-full border-2 border-surface-200-700 shadow-lg flex items-center justify-center"
	style="width: {diameter}px; height: {diameter}px;"
>
	{#each handlePositions as position, i}
		<Handle
			type="source"
			position={Position.Top}
			id="{position.handle.id}-source"
			style="left: {position.x - 8}px; top: {position.y -
				8}px; position: absolute; transform: none; background-color: {position.handle.status
				? 'var(--color-success-500)'
				: 'var(--color-surface-400)'};"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber}"
			isConnectable={true}
		/>
		<Handle
			type="target"
			position={Position.Top}
			id="{position.handle.id}-target"
			style="left: {position.x - 8}px; top: {position.y -
				8}px; position: absolute; transform: none; background-color: {position.handle.status
				? 'var(--color-success-500)'
				: 'var(--color-surface-400)'};"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber}"
			isConnectable={true}
		/>
	{/each}
</div>
