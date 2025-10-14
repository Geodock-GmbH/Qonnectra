<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// SvelteFlow
	import { Handle, Position } from '@xyflow/svelte';

	let { id, data, selected = false } = $props();

	const trench = $derived(data?.trench || null);
	const conduit = $derived(data?.conduit || null);
	const totalMicroducts = $derived(data?.totalMicroducts || 0);
	const nodeName = $derived(data?.nodeName || '');
	const handleCount = $derived(Math.max(1, totalMicroducts));
	const radius = $derived(Math.max(120, 80 + handleCount * 10));
	const diameter = $derived(radius * 2);

	/**
	 * Get contrasting text color (black or white) for a given background color
	 * @param {string} hexColor - Hex color code
	 * @returns {string} 'black' or 'white'
	 */
	function getContrastColor(hexColor) {
		if (!hexColor) return 'white';

		// Convert hex to RGB
		const hex = hexColor.replace('#', '');
		const r = parseInt(hex.substr(0, 2), 16);
		const g = parseInt(hex.substr(2, 2), 16);
		const b = parseInt(hex.substr(4, 2), 16);

		// Calculate luminance
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

		return luminance > 0.5 ? 'black' : 'white';
	}

	const handleData = $derived(() => {
		if (!conduit || !conduit.microducts) return [];

		const handles = [];
		conduit.microducts.forEach((microduct, micIndex) => {
			const hexCode = microduct.hex_code || '#64748b'; // Default gray
			const hexCodeSecondary = microduct.hex_code_secondary;
			const isTwoLayer = microduct.is_two_layer || false;
			console.log(isTwoLayer);

			handles.push({
				id: `conduit-${conduit.uuid}-microduct-${microduct.number}`,
				microductUuid: microduct.uuid,
				microductNumber: microduct.number,
				conduitName: conduit.name,
				conduitUuid: conduit.uuid,
				status: microduct.microduct_status,
				color: microduct.color,
				cssColor: hexCode,
				borderColor: hexCodeSecondary,
				isTwoLayer: isTwoLayer,
				contrastColor: getContrastColor(hexCode)
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

<!-- Node label and content box positioned above and to the left -->
<div
	class="absolute top-0 left-0 bg-surface-50-950 border border-surface-200-700 rounded-lg shadow-md p-2 min-w-[120px] max-w-[250px]"
	style="transform: translate(-100%, -100%);"
>
	<div class="flex flex-col gap-1">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold text-surface-600-300 whitespace-nowrap"
				>{m.form_trench_id()}:</span
			>
			<span class="font-semibold text-xs text-surface-600-300 break-words"
				>{trench?.id_trench || 'N/A'}</span
			>
		</div>
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold text-surface-700-200 whitespace-nowrap"
					>{m.form_conduit()}:</span
				>
				<span class="font-semibold text-xs text-surface-700-200 break-words"
					>{conduit?.name || 'N/A'}</span
				>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold text-surface-700-200 whitespace-nowrap"
					>{totalMicroducts}x {m.form_microduct({ count: totalMicroducts })}</span
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
	class="relative rounded-full border-2 border-surface-200-700 shadow-lg flex items-center justify-center"
	style="width: {diameter}px; height: {diameter}px;"
>
	{#each handlePositions as position, i}
		<Handle
			type="source"
			position={Position.Top}
			id="{position.handle.id}-source"
			style="left: {position.x - 12}px; top: {position.y -
				12}px; position: absolute; transform: none; background: {position.handle.isTwoLayer
				? `linear-gradient(to right, ${position.handle.cssColor} 50%, ${position.handle.borderColor} 50%)`
				: position.handle
						.cssColor}; border: 2px solid var(--color-surface-950-50); width: 24px; height: 24px; {position
				.handle.status
				? 'opacity: 0.5; text-decoration: line-through;'
				: ''}"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber} ({position
				.handle.color})"
			isConnectable={true}
		/>
		<Handle
			type="target"
			position={Position.Top}
			id="{position.handle.id}-target"
			style="left: {position.x - 12}px; top: {position.y -
				12}px; position: absolute; transform: none; background: {position.handle.isTwoLayer
				? `linear-gradient(to right, ${position.handle.cssColor} 50%, ${position.handle.borderColor} 50%)`
				: position.handle
						.cssColor}; border: 2px solid var(--color-surface-950-50); width: 24px; height: 24px; {position
				.handle.status
				? 'opacity: 0.5; text-decoration: line-through;'
				: ''}"
			title="{position.handle.conduitName} - Microduct {position.handle.microductNumber} ({position
				.handle.color})"
			isConnectable={true}
		/>
		{#if position.handle.status}
			<div
				class="absolute pointer-events-none flex items-center justify-center text-surface-950-50 font-bold text-2xl"
				style="left: {position.x - 12}px; top: {position.y -
					12}px; width: 24px; height: 24px; z-index: 10;"
			>
				✕
			</div>
		{/if}
	{/each}
</div>
