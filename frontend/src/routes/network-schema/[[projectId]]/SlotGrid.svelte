<script>
	import { IconGripVertical, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		slotRows = [],
		structures = [],
		selectedStructure = null,
		isDragging = false,
		draggedItem = null,
		dropPreviewSlots = $bindable([]),
		componentRanges = [],
		occupiedSlots = new Map(),
		loading = false,
		loadingStructures = false,
		isMobile = false,
		mobileSelectedItem = null,
		onSlotDragOver = () => {},
		onSlotDrop = () => {},
		onSlotTap = () => {},
		onStructureDragStart = () => {},
		onStructureDragEnd = () => {},
		onStructureSelect = () => {},
		onStructureDelete = () => {},
		onToggleDivider = () => {},
		onStartEditingClip = () => {},
		editingClipSlot = null,
		editingClipValue = $bindable(''),
		onSaveClipNumber = () => {},
		onClipKeydown = () => {}
	} = $props();

	/**
	 * Check if a slot is the first slot of a component range in multi-drop preview
	 * @param {number} slotNumber
	 * @returns {boolean}
	 */
	function isComponentRangeStart(slotNumber) {
		return componentRanges.some((r) => r.start === slotNumber);
	}

	/**
	 * Check if a slot is the last slot of a component range in multi-drop preview
	 * @param {number} slotNumber
	 * @returns {boolean}
	 */
	function isComponentRangeEnd(slotNumber) {
		return componentRanges.some((r) => r.end === slotNumber);
	}

	function handleSlotDragOver(e, slotNumber) {
		e.preventDefault();
		onSlotDragOver(e, slotNumber);
	}

	function handleSlotDragLeave(e) {
		// Only clear if leaving the drop zone area entirely
		const relatedTarget = e.relatedTarget;
		if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
			// Keep preview if moving within slot rows
		}
	}

	function handleGridDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			dropPreviewSlots = [];
		}
	}

	function handleSlotDrop(e, slotNumber) {
		e.preventDefault();
		onSlotDrop(e, slotNumber);
	}

	function handleSlotClick(row) {
		if (isMobile && mobileSelectedItem) {
			// Mobile: tap to place
			onSlotTap(row.slotNumber);
		} else if (row.structure) {
			// Desktop: select structure
			onStructureSelect(row.structure);
		}
	}
</script>

<div
	class="h-full flex flex-col border border-surface-200-800 rounded-xl overflow-hidden bg-surface-100-900 shadow-sm"
>
	<!-- Header row (outside scrollable area) -->
	<div class="slot-grid-header grid grid-cols-[60px_1fr_80px] bg-surface-200-800 flex-shrink-0">
		<div class="px-3 py-2.5 text-center font-semibold text-sm">{m.form_tpu()}</div>
		<div class="px-3 py-2.5 font-semibold text-sm">{m.form_component()}</div>
		<div class="px-3 py-2.5 text-center font-semibold text-sm">{m.form_clip_number()}</div>
	</div>

	<!-- Scrollable content -->
	<div
		class="flex-1 overflow-auto"
		ondragleave={handleGridDragLeave}
		role="list"
		aria-label={m.form_slot_grid?.() || 'Slot grid'}
	>
		{#if loading || loadingStructures}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-950-50">{m.common_loading()}</span>
			</div>
		{:else if slotRows.length === 0}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-950-50">{m.message_no_slot_configurations()}</span>
			</div>
		{:else}
			<div
				class="grid grid-cols-[60px_1fr_80px] bg-[var(--color-surface-50-950)] {isDragging
					? '[&_.slot-content:not(.drop-target)]:opacity-60'
					: ''} {mobileSelectedItem ? '[&_.slot-content:not(.mobile-tap-target)]:opacity-50' : ''}"
			>
				{#each slotRows as row (row.slotNumber)}
					<!-- TPU number cell -->
					<div
						class="px-3 py-2 font-mono text-center bg-[var(--color-surface-100-900)] border-b border-[var(--color-surface-200-800)] transition-colors duration-150 h-10 flex items-center justify-center {row.isDropTarget
							? 'bg-[rgba(34,197,94,0.15)]'
							: ''} {row.isOccupied && !row.isDropTarget
							? 'bg-[var(--color-surface-200-800)]'
							: ''} {row.hasDividerAfter
							? 'border-b-2 border-[var(--color-surface-500)] relative z-10'
							: ''}"
						ondblclick={() => onToggleDivider(row.slotNumber)}
						title={m.tooltip_double_click_divider?.() || 'Double-click to toggle divider'}
						role="cell"
						tabindex="0"
					>
						{row.slotNumber}
					</div>

					<!-- Component cell -->
					<div
						class="slot-content px-2 py-0.5 min-h-10 bg-[var(--color-surface-50-950)] border-b border-[var(--color-surface-200-800)] flex items-center transition-[background-color,outline] duration-150 relative {row.isDropTarget &&
						(!row.isOccupied ||
							(draggedItem?.type === 'existing_structure' &&
								occupiedSlots.get(row.slotNumber) === draggedItem?.uuid))
							? 'bg-[rgba(34,197,94,0.1)] outline-2 outline-dashed outline-green-500 outline-offset-[-2px]'
							: ''} {row.isDropTarget &&
						row.isOccupied &&
						(draggedItem?.type !== 'existing_structure' ||
							occupiedSlots.get(row.slotNumber) !== draggedItem?.uuid)
							? 'bg-[rgba(239,68,68,0.1)] outline-2 outline-dashed outline-red-500 outline-offset-[-2px]'
							: ''} {row.hasDividerAfter
							? 'border-b-2 border-[var(--color-surface-500)] relative z-10'
							: ''} {isMobile && mobileSelectedItem && !row.isOccupied
							? 'bg-[var(--color-primary-500)]/5 cursor-pointer hover:bg-[var(--color-primary-500)]/10'
							: ''} {isComponentRangeStart(row.slotNumber) && componentRanges.length > 1
							? 'border-t-2 border-t-green-500'
							: ''} {isComponentRangeEnd(row.slotNumber) && componentRanges.length > 1
							? 'border-b-2 border-b-green-500'
							: ''}"
						ondragover={(e) => handleSlotDragOver(e, row.slotNumber)}
						ondragleave={handleSlotDragLeave}
						ondrop={(e) => handleSlotDrop(e, row.slotNumber)}
						onclick={() => handleSlotClick(row)}
						onkeydown={(e) => e.key === 'Enter' && handleSlotClick(row)}
						role="gridcell"
						tabindex={row.isBlockStart || (!row.isOccupied && mobileSelectedItem) ? 0 : -1}
					>
						{#if row.isBlockStart && row.structure}
							<div
								class="structure-block w-[calc(100%-4px)] h-[calc(var(--row-height,36px)-4px)] px-2.5 py-1.5 bg-[var(--color-surface-200-800)] border border-[var(--color-surface-300-700)] rounded-lg cursor-pointer flex items-center gap-2 absolute top-0.5 left-0.5 z-[1] shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:bg-[var(--color-surface-300-700)] hover:shadow-md hover:-translate-y-px active:scale-[0.98] group {selectedStructure?.uuid ===
								row.structure?.uuid
									? 'bg-[var(--color-primary-500)] border-[var(--color-primary-600)] text-white shadow-[0_0_0_3px_var(--color-primary-500)/30%,0_4px_12px_rgba(0,0,0,0.15)] hover:bg-[var(--color-primary-400)] [&_.text-surface-950-50]:!text-white/80 [&_*:global(.text-surface-400)]:!text-white/70'
									: ''}"
								style:--row-height="{row.blockSize * 40}px"
								draggable={!isMobile}
								ondragstart={(e) => row.structure && onStructureDragStart(e, row.structure)}
								ondragend={onStructureDragEnd}
								role="button"
								tabindex="0"
							>
								{#if !isMobile}
									<IconGripVertical
										size={14}
										class="cursor-grab text-surface-950-50 flex-shrink-0"
									/>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm truncate">
										{row.structure?.component_type?.component_type || row.structure?.label || '-'}
									</div>
									{#if row.structure?.component_structure?.article_number}
										<div class="text-xs text-surface-950-50 truncate">
											{row.structure.component_structure.article_number}
										</div>
									{/if}
								</div>
								<button
									type="button"
									class="btn-sm rounded-md opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-error-500 hover:bg-error-600 text-white transition-all flex-shrink-0"
									onclick={(e) => {
										e.stopPropagation();
										row.structure && onStructureDelete(row.structure.uuid);
									}}
									aria-label={m.common_delete?.() || 'Delete'}
								>
									<IconTrash size={20} />
								</button>
							</div>
						{:else if !row.isOccupied}
							<span class="text-surface-950-50 text-sm">
								{#if isMobile && mobileSelectedItem}
									<span class="text-primary-500 text-xs"
										>{m.action_tap_to_place?.() || 'Tap to place'}</span
									>
								{:else}
									-
								{/if}
							</span>
						{/if}
					</div>

					<!-- Clip number cell (editable) -->
					<div
						class="px-3 py-2 font-mono text-center bg-[var(--color-surface-100-900)] border-b border-[var(--color-surface-200-800)] transition-colors duration-150 h-10 flex items-center justify-center {row.isDropTarget
							? 'bg-[rgba(34,197,94,0.15)]'
							: ''} {row.isOccupied && !row.isDropTarget
							? 'bg-[var(--color-surface-200-800)]'
							: ''} {row.hasDividerAfter
							? 'border-b-2 border-[var(--color-surface-500)] relative z-10'
							: ''}"
						role="gridcell"
					>
						{#if editingClipSlot === row.slotNumber}
							<input
								type="text"
								class="w-full h-7 bg-[var(--color-surface-50-950)] border-2 border-[var(--color-primary-500)] rounded font-mono text-center text-sm px-1 outline-none [&:focus]:shadow-[0_0_0_2px_var(--color-primary-500)/20]"
								bind:value={editingClipValue}
								onblur={onSaveClipNumber}
								onkeydown={onClipKeydown}
							/>
						{:else}
							<button
								type="button"
								class="w-full h-full bg-transparent border-none font-mono text-center cursor-pointer p-0 transition-colors duration-150 rounded hover:bg-[var(--color-surface-200-800)]"
								onclick={() => onStartEditingClip(row.slotNumber, row.clipNumber)}
								title={m.tooltip_click_to_edit?.() || 'Click to edit'}
							>
								{row.clipNumber || row.slotNumber}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
