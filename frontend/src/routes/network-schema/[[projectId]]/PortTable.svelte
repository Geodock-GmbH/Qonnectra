<script>
	import { getContext } from 'svelte';
	import { IconArrowMerge, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { NODE_STRUCTURE_CONTEXT_KEY } from '$lib/classes/NodeStructureContext.svelte.js';

	import FiberCell from './FiberCell.svelte';

	// Get context - most state comes from here
	const context = getContext(NODE_STRUCTURE_CONTEXT_KEY);

	// Only essential props needed for rendering
	let { structureName = '', portRows = [], loading = false } = $props();

	// Derive state from context
	const fiberColors = $derived(context?.fiberColors ?? []);
	const mergeSelectionMode = $derived(context?.mergeSelectionMode ?? false);
	const selectedForMerge = $derived(context?.selectedForMerge ?? new Set());
	const mergeSide = $derived(context?.mergeSide ?? 'a');

	// Color lookup map
	const colorMap = $derived.by(() => {
		const map = new Map();
		for (const color of fiberColors) {
			map.set(color.name_de, color.hex_code);
			map.set(color.name_en, color.hex_code);
		}
		return map;
	});

	// Compute grid columns based on merge mode
	const gridCols = $derived(
		mergeSelectionMode ? 'grid-cols-[40px_60px_1fr_1fr]' : 'grid-cols-[60px_1fr_1fr]'
	);

	function getColorHex(fiberColorName) {
		if (!fiberColorName) return '#999999';
		return colorMap.get(fiberColorName) || '#999999';
	}

	function handlePortDrop(portNumber, side, fiberData) {
		context?.portActions?.onDrop(portNumber, side, fiberData);
	}

	function handleClearPort(portNumber, side) {
		context?.portActions?.onClear(portNumber, side);
	}

	function handleClose() {
		context?.portActions?.onClose();
	}

	function handleToggleMergeMode() {
		context?.portActions?.onToggleMergeMode();
	}

	function handleTogglePortSelection(portNumber, side) {
		context?.portActions?.onTogglePortSelection(portNumber, side);
	}

	function handleMergePorts() {
		context?.portActions?.onMergePorts();
	}

	function handleUnmergePorts(mergeGroupId) {
		context?.portActions?.onUnmergePorts(mergeGroupId);
	}

	function handleMergedPortDrop(mergeGroupId, side, data) {
		context?.portActions?.onMergedPortDrop(mergeGroupId, side, data);
	}

	function handleSetMergeSide(side) {
		context?.portActions?.onSetMergeSide(side);
	}

	function isPortSelected(portNumber) {
		return selectedForMerge.has(`${portNumber}-${mergeSide}`);
	}

	// Check if this row should render the A cell (not spanned by previous row)
	function shouldRenderCellA(row) {
		if (!row.mergeInfoA) return true;
		return row.mergeInfoA.isFirstInGroup;
	}

	// Check if this row should render the B cell (not spanned by previous row)
	function shouldRenderCellB(row) {
		if (!row.mergeInfoB) return true;
		return row.mergeInfoB.isFirstInGroup;
	}

	// Check if a port can be selected for merging on the current side
	function canSelectForMerge(row) {
		if (mergeSide === 'a') {
			// Can select if: has IN port AND not already merged on A side
			return row.hasInPort && !row.mergeInfoA;
		} else {
			// Can select if: has OUT port AND not already merged on B side
			return row.hasOutPort && !row.mergeInfoB;
		}
	}

	// Get all selectable port numbers for the current side
	const selectablePortNumbers = $derived(
		portRows.filter((row) => canSelectForMerge(row)).map((row) => row.portNumber)
	);

	// Check if all selectable ports are selected
	const allSelected = $derived(
		selectablePortNumbers.length > 0 &&
			selectablePortNumbers.every((portNum) => selectedForMerge.has(`${portNum}-${mergeSide}`))
	);

	// Toggle all selectable ports
	function toggleSelectAll() {
		if (allSelected) {
			// Deselect all
			for (const portNum of selectablePortNumbers) {
				if (selectedForMerge.has(`${portNum}-${mergeSide}`)) {
					handleTogglePortSelection(portNum, mergeSide);
				}
			}
		} else {
			// Select all that aren't already selected
			for (const portNum of selectablePortNumbers) {
				if (!selectedForMerge.has(`${portNum}-${mergeSide}`)) {
					handleTogglePortSelection(portNum, mergeSide);
				}
			}
		}
	}
</script>

<div
	class="port-table-container h-full flex flex-col rounded-xl border border-surface-200-800 bg-surface-100-900 overflow-hidden"
>
	<!-- Header -->
	<div
		class="flex items-center justify-between px-3 py-2 bg-surface-200-800 border-b border-surface-200-800"
	>
		<div class="flex items-center gap-3">
			<div>
				<h4 class="font-semibold text-sm leading-tight">{structureName}</h4>
				<p class="text-[11px] leading-tight text-surface-950-50">
					{portRows.length}
					{m.form_ports?.() || 'Ports'}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="p-2 rounded-lg hover:bg-surface-300-700 transition-colors"
				onclick={handleClose}
				aria-label={m.common_close?.() || 'Close'}
			>
				<IconX size={18} />
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-8">
			<span class="text-surface-950-50">{m.common_loading()}</span>
		</div>
	{:else if portRows.length === 0}
		<div class="flex items-center justify-center py-8">
			<span class="text-surface-950-50">
				{m.message_no_ports?.() || 'No ports configured for this component'}
			</span>
		</div>
	{:else}
		<!-- Column Headers -->
		<div
			class="grid {gridCols} bg-surface-200-800 border-b border-surface-200-800 text-xs font-semibold uppercase tracking-wide text-surface-950-50"
		>
			{#if mergeSelectionMode}
				<div class="px-2 py-2.5 flex items-center justify-center">
					{#if selectablePortNumbers.length > 0}
						<input
							type="checkbox"
							class="checkbox"
							checked={allSelected}
							onchange={toggleSelectAll}
							title={allSelected ? 'Deselect all' : 'Select all'}
						/>
					{/if}
				</div>
			{/if}
			<div class="px-3 py-2.5 flex items-center justify-center">
				<span class="text-surface-950-50">{m.form_port?.() || 'Port'}</span>
			</div>
			<div
				class="px-3 py-2.5 flex items-center justify-between gap-2 border-l border-surface-200-800"
			>
				<span class="text-surface-950-50">{m.form_fiber_a?.() || 'Faser A'}</span>
				<button
					type="button"
					class="p-1.5 rounded-lg transition-colors text-surface-950-50 {mergeSelectionMode &&
					mergeSide === 'a'
						? 'preset-filled-primary-500 text-white'
						: 'hover:bg-surface-300-700'}"
					onclick={() => {
						if (mergeSelectionMode && mergeSide === 'a') {
							handleToggleMergeMode();
						} else if (mergeSelectionMode) {
							handleSetMergeSide('a');
						} else {
							handleSetMergeSide('a');
							handleToggleMergeMode();
						}
					}}
					title={m.action_merge_ports?.() || 'Merge ports'}
				>
					<IconArrowMerge size={20} />
				</button>
			</div>
			<div
				class="px-3 py-2.5 flex items-center justify-between gap-2 border-l border-surface-200-800"
			>
				<span class="text-surface-950-50">{m.form_fiber_b?.() || 'Faser B'} </span>
				<button
					type="button"
					class="p-1.5 rounded-lg transition-colors text-surface-950-50 {mergeSelectionMode &&
					mergeSide === 'b'
						? 'preset-filled-primary-500 text-white'
						: 'hover:bg-surface-300-700'}"
					onclick={() => {
						if (mergeSelectionMode && mergeSide === 'b') {
							handleToggleMergeMode();
						} else if (mergeSelectionMode) {
							handleSetMergeSide('b');
						} else {
							handleSetMergeSide('b');
							handleToggleMergeMode();
						}
					}}
					title={m.action_merge_ports?.() || 'Merge ports'}
				>
					<IconArrowMerge size={20} />
				</button>
			</div>
		</div>

		<!-- Scrollable table body using single grid -->
		<div class="flex-1 overflow-y-auto min-h-0">
			<div class="grid {gridCols}" style="grid-auto-rows: minmax(44px, auto);">
				{#each portRows as row (row.portNumber)}
					<!-- Checkbox column (merge mode only) -->
					{#if mergeSelectionMode}
						<div
							class="px-2 py-2.5 flex items-center justify-center border-b border-surface-200-800"
						>
							{#if canSelectForMerge(row)}
								<input
									type="checkbox"
									class="checkbox"
									checked={isPortSelected(row.portNumber)}
									onchange={() => handleTogglePortSelection(row.portNumber, mergeSide)}
								/>
							{/if}
						</div>
					{/if}

					<!-- Port Number -->
					<div
						class="px-3 py-2.5 text-center font-mono text-sm bg-surface-200-800 border-r border-b border-surface-200-800 flex items-center justify-center"
					>
						{row.portNumber}
					</div>

					<!-- Fiber A Cell (IN) -->
					{#if shouldRenderCellA(row)}
						{#if row.mergeInfoA}
							<!-- Merged cell spanning multiple rows -->
							<FiberCell
								fiber={row.mergeInfoA.fibers?.[0] || null}
								hasPort={row.hasInPort}
								side="a"
								portNumber={row.portNumber}
								cableUuid={row.mergeInfoA.fibers?.[0]?.cable_uuid}
								colorHex={getColorHex(row.mergeInfoA.fibers?.[0]?.fiber_color)}
								isMerged={true}
								mergedCount={row.mergeInfoA.groupSize}
								connectedCount={row.mergeInfoA.fiberCount}
								spanRows={row.mergeInfoA.groupSize}
								portRange={row.mergeInfoA.portRange}
								onDrop={(data) => handleMergedPortDrop(row.mergeInfoA.groupId, 'a', data)}
								onClear={() => handleClearPort(row.portNumber, 'a')}
								onUnmerge={() => handleUnmergePorts(row.mergeInfoA.groupId)}
							/>
						{:else}
							<!-- Normal unmerged cell -->
							<FiberCell
								fiber={row.fiberA}
								hasPort={row.hasInPort}
								side="a"
								portNumber={row.portNumber}
								cableUuid={row.fiberA?.cable_uuid}
								colorHex={getColorHex(row.fiberA?.fiber_color)}
								onDrop={(data) => handlePortDrop(row.portNumber, 'a', data)}
								onClear={() => handleClearPort(row.portNumber, 'a')}
							/>
						{/if}
					{/if}

					<!-- Fiber B Cell (OUT) -->
					{#if shouldRenderCellB(row)}
						{#if row.mergeInfoB}
							<!-- Merged cell spanning multiple rows -->
							<FiberCell
								fiber={row.mergeInfoB.fibers?.[0] || null}
								hasPort={row.hasOutPort}
								side="b"
								portNumber={row.portNumber}
								cableUuid={row.mergeInfoB.fibers?.[0]?.cable_uuid}
								colorHex={getColorHex(row.mergeInfoB.fibers?.[0]?.fiber_color)}
								isMerged={true}
								mergedCount={row.mergeInfoB.groupSize}
								connectedCount={row.mergeInfoB.fiberCount}
								spanRows={row.mergeInfoB.groupSize}
								portRange={row.mergeInfoB.portRange}
								onDrop={(data) => handleMergedPortDrop(row.mergeInfoB.groupId, 'b', data)}
								onClear={() => handleClearPort(row.portNumber, 'b')}
								onUnmerge={() => handleUnmergePorts(row.mergeInfoB.groupId)}
							/>
						{:else}
							<!-- Normal unmerged cell -->
							<FiberCell
								fiber={row.fiberB}
								hasPort={row.hasOutPort}
								side="b"
								portNumber={row.portNumber}
								cableUuid={row.fiberB?.cable_uuid}
								colorHex={getColorHex(row.fiberB?.fiber_color)}
								onDrop={(data) => handlePortDrop(row.portNumber, 'b', data)}
								onClear={() => handleClearPort(row.portNumber, 'b')}
							/>
						{/if}
					{/if}
				{/each}
			</div>
		</div>

		<!-- Merge Action Bar (when ports selected) -->
		{#if mergeSelectionMode && selectedForMerge.size >= 2}
			<div
				class="p-2 border-t border-surface-200-800 bg-surface-200-800 flex justify-between items-center gap-2"
			>
				<span class="text-xs text-surface-950-50">
					{m.form_side?.() || 'Side'}: {mergeSide === 'a' ? 'A (IN)' : 'B (OUT)'}
				</span>
				<button
					type="button"
					class="btn preset-filled-primary-500 text-sm"
					onclick={handleMergePorts}
				>
					<IconArrowMerge size={16} />
					{m.action_merge?.() || 'Merge'}
					{selectedForMerge.size}
					{m.form_ports?.() || 'Ports'}
				</button>
			</div>
		{/if}
	{/if}
</div>
