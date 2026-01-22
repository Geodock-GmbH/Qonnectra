<script>
	import { IconArrowsSplit, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		fiber = null,
		hasPort = true,
		side = 'a',
		colorHex = '#999999',
		portNumber = 0,
		cableUuid = null,
		onDrop = () => {},
		onClear = () => {},
		onUnmerge = () => {},
		// Merge props
		isMerged = false,
		mergedCount = 0,
		connectedCount = 0,
		// Spanning props for merged cells
		spanRows = 1,
		portRange = ''
	} = $props();

	let isDragOver = $state(false);
	let isDragging = $state(false);

	// Color accent based on side
	const accentClasses = $derived(
		side === 'a'
			? {
					bg: 'bg-secondary-50-950',
					bgHover: 'bg-secondary-200-800',
					outline: 'outline-blue-400',
					clearHover: 'hover:bg-secondary-50-950'
				}
			: {
					bg: 'bg-secondary-50-950',
					bgHover: 'bg-secondary-200-800',
					outline: 'outline-amber-400',
					clearHover: 'hover:bg-secondary-50-950'
				}
	);

	function handleDragStart(e) {
		if (!fiber || !hasPort || isMerged) return;

		isDragging = true;

		// Create drag data with fiber info and source location
		const dragData = {
			type: 'fiber',
			uuid: fiber.uuid,
			cable_uuid: cableUuid || fiber.cable_uuid,
			cable_name: fiber.cable_name,
			fiber_number: fiber.fiber_number,
			fiber_color: fiber.fiber_color,
			bundle_number: fiber.bundle_number,
			// Source info for move operation
			sourcePortNumber: portNumber,
			sourceSide: side,
			isMove: true
		};

		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragEnd() {
		isDragging = false;
	}

	function handleDragOver(e) {
		if (!hasPort) return;
		e.preventDefault();
		e.stopPropagation();
		// Accept both copy (external drops) and move (internal reorder)
		if (e.dataTransfer.effectAllowed === 'move') {
			e.dataTransfer.dropEffect = 'move';
		} else {
			e.dataTransfer.dropEffect = 'copy';
		}
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e) {
		if (!hasPort) return;
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;

		const jsonData = e.dataTransfer.getData('application/json');
		if (jsonData) {
			try {
				const data = JSON.parse(jsonData);
				onDrop(data);
			} catch (err) {
				console.error('Failed to parse drop data:', err);
			}
		}
	}
</script>

<div
	class="fiber-cell px-3 py-2 min-h-[44px] transition-all duration-150 border-l border-b border-surface-200-800 {!hasPort
		? 'bg-surface-200-800 cursor-not-allowed'
		: ''} {isDragOver && hasPort
		? `${accentClasses.bgHover} outline outline-dashed ${accentClasses.outline}`
		: ''} {fiber && spanRows <= 1 ? accentClasses.bg : ''} {spanRows > 1
		? 'bg-surface-50 dark:bg-surface-900  border-primary-500 '
		: ''} flex items-center"
	style={spanRows > 1 ? `grid-row: span ${spanRows}` : ''}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role={hasPort ? 'button' : 'presentation'}
>
	{#if fiber}
		<!-- Connected Fiber Display - draggable for move operations, also accepts drops for override -->
		<div
			class="flex items-center gap-2 group w-full {!isMerged
				? 'cursor-grab active:cursor-grabbing'
				: ''} {isDragging ? 'opacity-50' : ''}"
			draggable={!isMerged}
			ondragstart={handleDragStart}
			ondragend={handleDragEnd}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			role="button"
			tabindex="0"
		>
			<span
				class="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
				style="background-color: {colorHex}"
			></span>
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-1.5 text-sm font-medium">
					<span class="font-mono">{fiber.fiber_number}</span>
					<span class="text-surface-400">|</span>
					<span class="text-surface-500">B{fiber.bundle_number}</span>
				</div>
				<div class="text-xs text-surface-400 truncate">
					{fiber.cable_name}
				</div>
			</div>
			<div class="flex items-center gap-1 ml-auto">
				{#if spanRows > 1}
					<button
						type="button"
						class="p-1 rounded hover:bg-surface-300-700 transition-colors opacity-0 group-hover:opacity-100"
						onclick={(e) => {
							e.stopPropagation();
							onUnmerge();
						}}
						title={m.action_unmerge?.() || 'Unmerge'}
					>
						<IconArrowsSplit size={16} />
					</button>
				{/if}
				<button
					type="button"
					class="btn-sm p-1 rounded-md opacity-0 group-hover:opacity-100 bg-error-500 hover:bg-error-600 text-white transition-all flex-shrink-0"
					onclick={(e) => {
						e.stopPropagation();
						onClear();
					}}
					aria-label={m.common_clear?.() || 'Clear'}
				>
					<IconTrash size={20} />
				</button>
			</div>
		</div>
	{:else if hasPort}
		<!-- Empty Drop Zone -->
		<div class="flex flex-col items-center justify-center w-full h-full text-surface-400 group">
			{#if spanRows > 1}
				<!-- Merged empty state with port range -->
				<div
					class="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 mb-1"
				>
					<span class="font-mono">{portRange}</span>
					<button
						type="button"
						class="p-1 rounded hover:bg-surface-300-700 transition-colors opacity-0 group-hover:opacity-100"
						onclick={(e) => {
							e.stopPropagation();
							onUnmerge();
						}}
						title={m.action_unmerge?.() || 'Unmerge'}
					>
						<IconArrowsSplit size={14} />
					</button>
				</div>
			{/if}
			<div class="flex items-center gap-2 text-xs italic">
				<span>{m.message_drop_fiber_here()}</span>
			</div>
		</div>
	{:else}
		<!-- No Port -->
		<div class="flex items-center justify-center h-full">
			<span class="text-surface-300 text-sm">-</span>
		</div>
	{/if}
</div>
