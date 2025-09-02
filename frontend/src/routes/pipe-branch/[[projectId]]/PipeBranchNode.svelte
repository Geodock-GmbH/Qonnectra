<script>
	// Skeleton
	import { createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// SvelteFlow
	import { Position, Handle } from '@xyflow/svelte';

	// Color mapping
	import {
		getMicroductColor,
		getContrastColor,
		getMicroductBorderColor,
		isTwoLayerColor
	} from '$lib/utils/microductColors.js';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { id, data, selected = false } = $props();

	const trench = $derived(data?.trench || null);
	const conduit = $derived(data?.conduit || null);
	const totalMicroducts = $derived(data?.totalMicroducts || 0);
	const nodeName = $derived(data?.nodeName || '');
	const handleCount = $derived(Math.max(1, totalMicroducts));
	const radius = $derived(Math.max(120, 80 + handleCount * 10));
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
				status: microduct.microduct_status,
				color: microduct.color,
				cssColor: getMicroductColor(microduct.color),
				borderColor: getMicroductBorderColor(microduct.color),
				isTwoLayer: isTwoLayerColor(microduct.color),
				contrastColor: getContrastColor(microduct.color)
			});
		});
		return handles;
	});

	const handlePositions = $derived(
		handleData().map((handle, i) => {
			const x = radius; // Center horizontally
			const spacing = handleCount > 1 ? (diameter - 60) / (handleCount - 1) : 0;
			const y = 30 + i * spacing;
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
<!-- Explanation why we have source and target handles over each other -->
<!-- When the mousepointer is over a handle, it uses the source id. This happens when also when the user releases the mousebutton over a handle. -->
<!-- This would not create an edge on the canvas (but in the db so its visible on reload), so we can only connect per snapping. Since its always snapping to the target handle. -->
<div
	class="relative bg-surface-50-950 rounded-full border-2 border-surface-200-700 shadow-lg flex items-center justify-center"
	style="width: {diameter}px; height: {diameter}px;"
>
	{#each handlePositions as position, i}
		<Handle
			type="source"
			position={Position.Top}
			id="{position.handle.id}-source"
			style="left: {position.x - 12}px; top: {position.y -
				12}px; position: absolute; transform: none; background-color: {position.handle
				.cssColor}; border: {position.handle.isTwoLayer && position.handle.borderColor
				? `3px solid ${position.handle.borderColor}`
				: 'none'}; width: 24px; height: 24px; display: {position.handle.status
				? 'none'
				: 'inline'};"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber} ({position
				.handle.color})"
			isConnectable={true}
		/>
		<Handle
			type="target"
			position={Position.Top}
			id="{position.handle.id}-target"
			style="left: {position.x - 12}px; top: {position.y -
				12}px; position: absolute; transform: none; background-color: {position.handle
				.cssColor}; border: {position.handle.isTwoLayer && position.handle.borderColor
				? `3px solid ${position.handle.borderColor}`
				: 'none'}; width: 24px; height: 24px; display: {position.handle.status
				? 'none'
				: 'inline'};"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber} ({position
				.handle.color})"
			isConnectable={true}
		/>
	{/each}
</div>
