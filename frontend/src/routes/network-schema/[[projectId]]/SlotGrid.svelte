<script>
	import { getContext } from 'svelte';
	import { IconGripVertical, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { NODE_STRUCTURE_CONTEXT_KEY } from '$lib/classes/NodeStructureContext.svelte.js';
	import { tooltip } from '$lib/utils/tooltip.js';

	// Get context - most state comes from here
	const context = getContext(NODE_STRUCTURE_CONTEXT_KEY);

	// Only essential props that vary between usages or need binding
	let {
		slotRows = [],
		loading = false,
		loadingStructures = false,
		isMobile = false,
		// These callbacks need wrappers in parent for UI state management
		onStructureSelect = () => {},
		onStructureDelete = () => {}
	} = $props();

	// Derive state from context
	const structures = $derived(context?.structures ?? []);
	const selectedStructure = $derived(context?.selectedStructure ?? null);
	const isDragging = $derived(context?.isDragging ?? false);
	const draggedItem = $derived(context?.draggedItem ?? null);
	const dropPreviewSlots = $derived(context?.dropPreviewSlots ?? []);
	const componentRanges = $derived(context?.componentRanges ?? []);
	const occupiedSlots = $derived(context?.occupiedSlots ?? new Map());
	const mobileSelectedItem = $derived(context?.mobileSelectedItem ?? null);
	const editingClipSlot = $derived(context?.editingClipSlot ?? null);
	const editingClipValue = $derived(context?.editingClipValue ?? '');

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
		context?.slotActions?.onDragOver(e, slotNumber);
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
			if (context) {
				context.dropPreviewSlots = [];
			}
		}
	}

	function handleSlotDrop(e, slotNumber) {
		e.preventDefault();
		context?.slotActions?.onDrop(e, slotNumber);
	}

	function handleSlotClick(row) {
		if (isMobile && mobileSelectedItem) {
			// Mobile: tap to place
			context?.slotActions?.onTap(row.slotNumber);
		} else if (row.structure) {
			// Desktop: select structure
			onStructureSelect(row.structure);
		}
	}

	function handleStructureDragStart(e, structure) {
		context?.structureActions?.onDragStart(e, structure);
	}

	function handleStructureDragEnd() {
		context?.structureActions?.onDragEnd();
	}

	function handleToggleDivider(slotNumber) {
		context?.dividerActions?.onToggle(slotNumber);
	}

	function handleStartEditingClip(slotNumber, currentValue) {
		context?.clipActions?.onStartEditing(slotNumber, currentValue);
	}

	function handleSaveClipNumber() {
		context?.clipActions?.onSave();
	}

	function handleClipKeydown(e) {
		context?.clipActions?.onKeydown(e);
	}

	// For binding the editing value
	function handleClipInput(e) {
		if (context) {
			context.editingClipValue = e.target.value;
		}
	}
</script>

<div
	class="h-full flex flex-col border border-surface-200-800 rounded-xl overflow-hidden bg-surface-100-900 shadow-sm"
>
	<!-- Header row (outside scrollable area) -->
	<div class="slot-grid-header grid grid-cols-[60px_1fr_80px] bg-surface-200-800 shrink-0">
		<div class="px-3 py-2.5 text-center font-semibold text-sm">{m.form_tpu()}</div>
		<div class="px-3 py-2.5 font-semibold text-sm">{m.form_component()}</div>
		<div class="px-3 py-2.5 text-left font-semibold text-sm">{m.form_clip_number()}</div>
	</div>

	<!-- Scrollable content -->
	<div
		class="flex-1 overflow-auto"
		ondragleave={handleGridDragLeave}
		role="list"
		aria-label={m.form_slot_grid()}
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
				class="grid grid-cols-[60px_1fr_80px] bg-(--color-surface-50-950) {isDragging
					? '[&_.slot-content:not(.drop-target)]:opacity-60'
					: ''} {mobileSelectedItem ? '[&_.slot-content:not(.mobile-tap-target)]:opacity-50' : ''}"
			>
				{#each slotRows as row (row.slotNumber)}
					<!-- TPU number cell -->
					<div
						class="px-3 py-2 font-mono text-center bg-(--color-surface-200-800) border-b border-(--color-surface-200-800) transition-colors duration-150 h-10 flex items-center justify-center {row.isDropTarget
							? 'bg-[rgba(34,197,94,0.15)]'
							: ''} {row.isOccupied && !row.isDropTarget
							? 'bg-(--color-surface-200-800)'
							: ''} {row.hasDividerAfter
							? 'border-b-2 border-(--color-surface-500) relative z-10'
							: ''}"
						ondblclick={() => handleToggleDivider(row.slotNumber)}
						{@attach tooltip(m.tooltip_double_click_divider())}
						role="cell"
						tabindex="0"
					>
						{row.slotNumber}
					</div>

					<!-- Component cell -->
					<div
						class="slot-content px-2 py-0.5 min-h-10 bg-(--color-surface-50-950) border-b border-(--color-surface-200-800) flex items-center transition-[background-color,outline] duration-150 relative {row.isDropTarget &&
						(!row.isOccupied ||
							(draggedItem?.type === 'existing_structure' &&
								occupiedSlots.get(row.slotNumber) === draggedItem?.uuid))
							? 'bg-[rgba(34,197,94,0.1)] outline-2 outline-dashed outline-green-500 -outline-offset-2'
							: ''} {row.isDropTarget &&
						row.isOccupied &&
						(draggedItem?.type !== 'existing_structure' ||
							occupiedSlots.get(row.slotNumber) !== draggedItem?.uuid)
							? 'bg-[rgba(239,68,68,0.1)] outline-2 outline-dashed outline-red-500 outline-offset-2'
							: ''} {row.hasDividerAfter
							? 'border-b-2 border-(--color-surface-500) relative z-10'
							: ''} {isMobile && mobileSelectedItem && !row.isOccupied
							? 'bg-(--color-primary-500)/5 cursor-pointer hover:bg-(--color-primary-500)/10'
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
								class="structure-block w-[calc(100%-4px)] h-[calc(var(--row-height,36px)-4px)] px-2.5 py-1.5 bg-(--color-surface-200-800) border border-(--color-surface-300-700) rounded-lg cursor-pointer flex items-center gap-2 absolute top-0.5 left-0.5 z-1 shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:bg-(--color-surface-300-700) hover:shadow-md hover:-translate-y-px active:scale-[0.98] group {selectedStructure?.uuid ===
								row.structure?.uuid
									? 'bg-(--color-primary-500) border-(--color-primary-600) text-white shadow-[0_0_0_3px_(--color-primary-500)/30%,0_4px_12px_rgba(0,0,0,0.15)] hover:bg-(--color-primary-400) [&_.text-surface-950-50]:text-white/80! [&_*:global(.text-surface-400)]:text-white/70! dark:bg-(--color-primary-200) dark:border-(--color-primary-300) dark:hover:bg-(--color-primary-300) dark:shadow-[0_0_0_3px_(--color-primary-500)/30%,0_4px_12px_rgba(0,0,0,0.15)] dark:[&_.text-surface-950-50]:text-surface-900! dark:[&_*:global(.text-surface-400)]:text-surface-600!'
									: ''}"
								style:--row-height="{row.blockSize * 40}px"
								draggable={!isMobile}
								ondragstart={(e) => row.structure && handleStructureDragStart(e, row.structure)}
								ondragend={handleStructureDragEnd}
								role="button"
								tabindex="0"
							>
								{#if !isMobile}
									<IconGripVertical size={14} class="cursor-grab text-surface-950-50 shrink-0" />
								{/if}
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm text-surface-950-50 truncate">
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
									class="btn-sm rounded-md opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-error-500 hover:bg-error-600 text-white transition-all shrink-0"
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
									<span class="text-primary-500 text-xs">{m.action_tap_to_place()}</span>
								{:else}
									-
								{/if}
							</span>
						{/if}
					</div>

					<!-- Clip number cell (editable) -->
					<div
						class="px-3 py-2 font-mono text-center bg-(--color-surface-200-800) border-b border-(--color-surface-200-800) transition-colors duration-150 h-10 flex items-center justify-center {row.isDropTarget
							? 'bg-[rgba(34,197,94,0.15)]'
							: ''} {row.isOccupied && !row.isDropTarget
							? 'bg-(--color-surface-200-800)'
							: ''} {row.hasDividerAfter
							? 'border-b-2 border-(--color-surface-500) relative z-10'
							: ''}"
						role="gridcell"
					>
						{#if editingClipSlot === row.slotNumber}
							<input
								type="text"
								class="w-full h-7 bg-(--color-surface-50-950) border-2 border-(--color-primary-500) rounded font-mono text-center text-sm px-1 outline-none focus:shadow-[0_0_0_2px_(--color-primary-500)/20]"
								value={editingClipValue}
								oninput={handleClipInput}
								onblur={handleSaveClipNumber}
								onkeydown={handleClipKeydown}
							/>
						{:else}
							<button
								type="button"
								class="w-full h-full bg-transparent border-none font-mono text-center cursor-pointer p-0 transition-colors duration-150 rounded hover:bg-(--color-surface-200-800)"
								onclick={() => handleStartEditingClip(row.slotNumber, row.clipNumber)}
								title={m.tooltip_click_to_edit()}
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
