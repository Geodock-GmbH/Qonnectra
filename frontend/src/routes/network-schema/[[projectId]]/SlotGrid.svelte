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
	class="flex-1 flex flex-col border border-surface-200-800 rounded-xl overflow-hidden bg-surface-100-900 shadow-sm"
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
				<span class="text-surface-500">{m.common_loading()}</span>
			</div>
		{:else if slotRows.length === 0}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.message_no_slot_configurations()}</span>
			</div>
		{:else}
			<div
				class="slot-grid"
				class:dragging={isDragging}
				class:mobile-selecting={mobileSelectedItem}
			>
				{#each slotRows as row (row.slotNumber)}
					<!-- TPU number cell -->
					<div
						class="slot-number"
						class:drop-target={row.isDropTarget}
						class:occupied={row.isOccupied && !row.isDropTarget}
						class:has-divider-after={row.hasDividerAfter}
						ondblclick={() => onToggleDivider(row.slotNumber)}
						title={m.tooltip_double_click_divider?.() || 'Double-click to toggle divider'}
						role="cell"
						tabindex="0"
					>
						{row.slotNumber}
					</div>

					<!-- Component cell -->
					<div
						class="slot-content"
						class:drop-target={row.isDropTarget}
						class:can-drop={row.isDropTarget &&
							(!row.isOccupied ||
								(draggedItem?.type === 'existing_structure' &&
									occupiedSlots.get(row.slotNumber) === draggedItem?.uuid))}
						class:cannot-drop={row.isDropTarget &&
							row.isOccupied &&
							(draggedItem?.type !== 'existing_structure' ||
								occupiedSlots.get(row.slotNumber) !== draggedItem?.uuid)}
						class:has-divider-after={row.hasDividerAfter}
						class:mobile-tap-target={isMobile && mobileSelectedItem && !row.isOccupied}
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
								class="structure-block group"
								class:selected={selectedStructure?.uuid === row.structure.uuid}
								style:--row-height="{row.blockSize * 40}px"
								draggable={!isMobile}
								ondragstart={(e) => onStructureDragStart(e, row.structure)}
								ondragend={onStructureDragEnd}
								role="button"
								tabindex="0"
							>
								{#if !isMobile}
									<IconGripVertical size={14} class="cursor-grab text-surface-400 flex-shrink-0" />
								{/if}
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm truncate">
										{row.structure.component_type?.component_type || row.structure.label || '-'}
									</div>
									{#if row.structure.component_structure?.article_number}
										<div class="text-xs text-surface-500 truncate">
											{row.structure.component_structure.article_number}
										</div>
									{/if}
								</div>
								<button
									type="button"
									class="delete-btn opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										onStructureDelete(row.structure.uuid);
									}}
									aria-label={m.common_delete?.() || 'Delete'}
								>
									<IconTrash size={16} class="text-surface-950-50" />
								</button>
							</div>
						{:else if !row.isOccupied}
							<span class="text-surface-400 text-sm">
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
						class="slot-clip"
						class:drop-target={row.isDropTarget}
						class:occupied={row.isOccupied && !row.isDropTarget}
						class:has-divider-after={row.hasDividerAfter}
						role="gridcell"
					>
						{#if editingClipSlot === row.slotNumber}
							<input
								type="text"
								class="clip-input"
								bind:value={editingClipValue}
								onblur={onSaveClipNumber}
								onkeydown={onClipKeydown}
							/>
						{:else}
							<button
								type="button"
								class="clip-value"
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

<style>
	.slot-grid {
		display: grid;
		grid-template-columns: 60px 1fr 80px;
		background: rgb(var(--color-surface-50));
	}

	@media (prefers-color-scheme: dark) {
		.slot-grid {
			background: rgb(var(--color-surface-900));
		}
	}

	.slot-number,
	.slot-clip {
		padding: 8px 12px;
		font-family: monospace;
		text-align: center;
		background: rgb(var(--color-surface-50));
		border-bottom: 1px solid rgb(var(--color-surface-200));
		transition: background-color 0.15s;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	@media (prefers-color-scheme: dark) {
		.slot-number,
		.slot-clip {
			background: rgb(var(--color-surface-900));
			border-bottom-color: rgb(var(--color-surface-700));
		}
	}

	.slot-content {
		padding: 2px 8px;
		min-height: 40px;
		background: rgb(var(--color-surface-50));
		border-bottom: 1px solid rgb(var(--color-surface-200));
		display: flex;
		align-items: center;
		transition:
			background-color 0.15s,
			outline 0.15s;
		position: relative;
	}

	@media (prefers-color-scheme: dark) {
		.slot-content {
			background: rgb(var(--color-surface-900));
			border-bottom-color: rgb(var(--color-surface-700));
		}
	}

	.slot-content.drop-target.can-drop {
		background: rgba(34, 197, 94, 0.1);
		outline: 2px dashed rgb(34, 197, 94);
		outline-offset: -2px;
	}

	.slot-content.drop-target.cannot-drop {
		background: rgba(239, 68, 68, 0.1);
		outline: 2px dashed rgb(239, 68, 68);
		outline-offset: -2px;
	}

	.slot-content.mobile-tap-target {
		background: rgba(var(--color-primary-500), 0.05);
		cursor: pointer;
	}

	.slot-content.mobile-tap-target:hover {
		background: rgba(var(--color-primary-500), 0.1);
	}

	.slot-number.drop-target,
	.slot-clip.drop-target {
		background: rgba(34, 197, 94, 0.15);
	}

	.slot-number.occupied,
	.slot-clip.occupied {
		background: rgba(var(--color-primary-500), 0.08);
	}

	.structure-block {
		width: calc(100% - 4px);
		height: var(--row-height, 36px);
		padding: 6px 10px;
		background: linear-gradient(
			135deg,
			rgba(var(--color-primary-500), 0.18),
			rgba(var(--color-primary-500), 0.1)
		);
		border: 1px solid rgba(var(--color-primary-500), 0.35);
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		position: absolute;
		top: 2px;
		left: 2px;
		z-index: 5;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		transition:
			background-color 0.15s,
			transform 0.1s,
			box-shadow 0.15s;
	}

	.structure-block:hover {
		background: linear-gradient(
			135deg,
			rgba(var(--color-primary-500), 0.2),
			rgba(var(--color-primary-500), 0.12)
		);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.structure-block:active {
		transform: scale(0.98);
	}

	.structure-block.selected {
		background: linear-gradient(
			135deg,
			rgba(var(--color-primary-500), 0.25),
			rgba(var(--color-primary-500), 0.15)
		);
		border-color: rgb(var(--color-primary-500));
		box-shadow: 0 0 0 2px rgba(var(--color-primary-500), 0.2);
	}

	.delete-btn {
		padding: 4px;
		background: rgb(var(--color-error-500));
		color: white;
		border-radius: 6px;
		transition:
			opacity 0.15s,
			background-color 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		background: rgb(var(--color-error-600));
	}

	.dragging .slot-content:not(.drop-target) {
		opacity: 0.6;
	}

	.mobile-selecting .slot-content:not(.mobile-tap-target) {
		opacity: 0.5;
	}

	/* Divider styles */
	.has-divider-after {
		border-bottom: 2px solid rgb(var(--color-surface-500)) !important;
	}

	/* Editable clip number styles */
	.clip-value {
		width: 100%;
		height: 100%;
		background: transparent;
		border: none;
		font-family: monospace;
		text-align: center;
		cursor: pointer;
		padding: 0;
		color: inherit;
		transition: background-color 0.15s;
		border-radius: 4px;
	}

	.clip-value:hover {
		background: rgba(var(--color-primary-500), 0.1);
	}

	.clip-input {
		width: 100%;
		height: 28px;
		background: white;
		border: 2px solid rgb(var(--color-primary-500));
		border-radius: 4px;
		font-family: monospace;
		text-align: center;
		font-size: 0.875rem;
		padding: 0 4px;
		outline: none;
	}

	.clip-input:focus {
		box-shadow: 0 0 0 2px rgba(var(--color-primary-500), 0.2);
	}

	@media (prefers-color-scheme: dark) {
		.clip-input {
			background: rgb(var(--color-surface-800));
		}
	}
</style>
