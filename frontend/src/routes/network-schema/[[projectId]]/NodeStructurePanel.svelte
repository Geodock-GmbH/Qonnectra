<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { IconGripVertical, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	import ComponentTypeSidebar from './ComponentTypeSidebar.svelte';

	let { nodeUuid, nodeName = '', initialSlotConfigUuid = null, sharedSlotState = $bindable(null) } = $props();

	// State
	let localSlotConfigurations = $state([]);
	let selectedSlotConfigUuid = $state(initialSlotConfigUuid);
	let structures = $state([]);
	let loading = $state(true);
	let loadingStructures = $state(false);

	// Drag state
	let isDragging = $state(false);
	let draggedItem = $state(null);
	let dropPreviewSlots = $state([]);

	// Update selection when initialSlotConfigUuid prop changes
	$effect(() => {
		if (initialSlotConfigUuid) {
			selectedSlotConfigUuid = initialSlotConfigUuid;
		}
	});

	// Use shared state if available, otherwise use local state
	const slotConfigurations = $derived(
		sharedSlotState?.slotConfigurations?.length > 0
			? sharedSlotState.slotConfigurations
			: localSlotConfigurations
	);

	// Derived
	const selectedConfig = $derived(
		slotConfigurations.find((c) => c.uuid === selectedSlotConfigUuid)
	);

	const containerPath = $derived.by(() => {
		if (!selectedConfig?.container) return null;
		return selectedConfig.container?.display_name || null;
	});

	// Compute which slots are occupied
	const occupiedSlots = $derived.by(() => {
		const occupied = new Map();
		for (const s of structures) {
			for (let i = s.slot_start; i <= s.slot_end; i++) {
				occupied.set(i, s.uuid);
			}
		}
		return occupied;
	});

	// Slot grid data
	const slotRows = $derived.by(() => {
		if (!selectedConfig) return [];
		const rows = [];
		for (let slot = 1; slot <= selectedConfig.total_slots; slot++) {
			const structure = structures.find((s) => s.slot_start <= slot && s.slot_end >= slot);
			rows.push({
				slotNumber: slot,
				structure,
				isBlockStart: structure?.slot_start === slot,
				blockSize: structure ? structure.slot_end - structure.slot_start + 1 : 0,
				isOccupied: occupiedSlots.has(slot),
				isDropTarget: dropPreviewSlots.includes(slot)
			});
		}
		return rows;
	});

	/**
	 * Fetch slot configurations for the node (fallback when shared state not available)
	 */
	async function fetchSlotConfigurations() {
		if (!nodeUuid) return;

		// Skip if we have shared state with data
		if (sharedSlotState?.slotConfigurations?.length > 0) {
			loading = false;
			if (!selectedSlotConfigUuid && slotConfigurations.length > 0) {
				selectedSlotConfigUuid = slotConfigurations[0].uuid;
			}
			return;
		}

		loading = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);

			const response = await fetch('?/getSlotConfigurationsForNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch slot configurations');
			}

			localSlotConfigurations = result.data?.configurations || [];

			if (!selectedSlotConfigUuid && localSlotConfigurations.length > 0) {
				selectedSlotConfigUuid = localSlotConfigurations[0].uuid;
			}
		} catch (err) {
			console.error('Error fetching slot configurations:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_slot_configurations()
			});
			localSlotConfigurations = [];
		} finally {
			loading = false;
		}
	}

	/**
	 * Fetch structures for the selected slot configuration
	 */
	async function fetchStructures() {
		if (!selectedSlotConfigUuid) {
			structures = [];
			return;
		}

		loadingStructures = true;
		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', selectedSlotConfigUuid);

			const response = await fetch('?/getNodeStructures', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch structures');
			}

			structures = result.data?.structures || [];
		} catch (err) {
			console.error('Error fetching structures:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_structures()
			});
			structures = [];
		} finally {
			loadingStructures = false;
		}
	}

	/**
	 * Handle side selection change
	 */
	function handleSideChange(e) {
		selectedSlotConfigUuid = e.target.value;
	}

	// Drag handlers
	function handleSidebarDragStart(componentType) {
		isDragging = true;
		draggedItem = {
			type: 'component_type',
			id: componentType.id,
			name: componentType.component_type,
			occupied_slots: componentType.occupied_slots
		};
	}

	function handleSidebarDragEnd() {
		isDragging = false;
		draggedItem = null;
		dropPreviewSlots = [];
	}

	function handleStructureDragStart(e, structure) {
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'existing_structure',
				uuid: structure.uuid,
				slot_start: structure.slot_start,
				slot_end: structure.slot_end,
				occupied_slots: structure.slot_end - structure.slot_start + 1
			})
		);
		e.dataTransfer.effectAllowed = 'move';
		isDragging = true;
		draggedItem = {
			type: 'existing_structure',
			uuid: structure.uuid,
			occupied_slots: structure.slot_end - structure.slot_start + 1
		};
	}

	function handleSlotDragOver(e, slotNumber) {
		e.preventDefault();

		const occupiedSlotsCount = draggedItem?.occupied_slots || 1;
		const previewEnd = Math.min(slotNumber + occupiedSlotsCount - 1, selectedConfig.total_slots);
		const preview = [];
		let canDrop = true;

		for (let i = slotNumber; i <= previewEnd; i++) {
			preview.push(i);
			// Check if slot is occupied by a DIFFERENT structure
			const occupyingStructureUuid = occupiedSlots.get(i);
			if (occupyingStructureUuid) {
				// Allow drop if dragging the same structure
				if (
					draggedItem?.type !== 'existing_structure' ||
					occupyingStructureUuid !== draggedItem?.uuid
				) {
					canDrop = false;
				}
			}
		}

		// Check if we have enough slots
		if (preview.length < occupiedSlotsCount) {
			canDrop = false;
		}

		dropPreviewSlots = preview;
		e.dataTransfer.dropEffect = canDrop ? 'copy' : 'none';
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

	async function handleSlotDrop(e, slotNumber) {
		e.preventDefault();
		const previewSlots = [...dropPreviewSlots];
		dropPreviewSlots = [];
		isDragging = false;

		try {
			const data = JSON.parse(e.dataTransfer.getData('application/json'));

			if (data.type === 'component_type') {
				await createStructure(data, slotNumber);
			} else if (data.type === 'existing_structure') {
				await moveStructure(data, slotNumber);
			}
		} catch (err) {
			console.error('Drop error:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_placing_component()
			});
		}

		draggedItem = null;
	}

	async function createStructure(componentData, slotStart) {
		const slotEnd = slotStart + componentData.occupied_slots - 1;

		// Validate
		if (slotEnd > selectedConfig.total_slots) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_not_enough_slots()
			});
			return;
		}

		// Check for overlaps
		for (let i = slotStart; i <= slotEnd; i++) {
			if (occupiedSlots.has(i)) {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_slots_occupied()
				});
				return;
			}
		}

		// Optimistic update
		const tempUuid = `temp-${Date.now()}`;
		const optimisticStructure = {
			uuid: tempUuid,
			slot_start: slotStart,
			slot_end: slotEnd,
			component_type: { id: componentData.id, component_type: componentData.name },
			component_structure: null,
			purpose: 'component',
			label: null
		};
		structures = [...structures, optimisticStructure];

		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);
			formData.append('slotConfigUuid', selectedSlotConfigUuid);
			formData.append('componentTypeId', componentData.id.toString());
			formData.append('slotStart', slotStart.toString());
			formData.append('slotEnd', slotEnd.toString());
			formData.append('purpose', 'component');

			const response = await fetch('?/createNodeStructure', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to create structure');
			}

			// Replace optimistic update with real data
			structures = structures.map((s) => (s.uuid === tempUuid ? result.data.structure : s));

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_placing_component()
			});
		} catch (err) {
			// Revert optimistic update
			structures = structures.filter((s) => s.uuid !== tempUuid);
			throw err;
		}
	}

	async function moveStructure(structureData, newSlotStart) {
		const slotCount = structureData.occupied_slots;
		const newSlotEnd = newSlotStart + slotCount - 1;

		// Validate bounds
		if (newSlotEnd > selectedConfig.total_slots) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_not_enough_slots()
			});
			return;
		}

		// Check for overlaps (excluding self)
		for (let i = newSlotStart; i <= newSlotEnd; i++) {
			const occupyingUuid = occupiedSlots.get(i);
			if (occupyingUuid && occupyingUuid !== structureData.uuid) {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_slots_occupied()
				});
				return;
			}
		}

		// Optimistic update
		const previousStructures = [...structures];
		structures = structures.map((s) => {
			if (s.uuid === structureData.uuid) {
				return { ...s, slot_start: newSlotStart, slot_end: newSlotEnd };
			}
			return s;
		});

		try {
			const formData = new FormData();
			formData.append('structureUuid', structureData.uuid);
			formData.append('slotStart', newSlotStart.toString());

			const response = await fetch('?/moveNodeStructure', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to move structure');
			}

			// Update with server response
			structures = structures.map((s) =>
				s.uuid === structureData.uuid ? result.data.structure : s
			);
		} catch (err) {
			// Revert optimistic update
			structures = previousStructures;
			throw err;
		}
	}

	async function handleDeleteStructure(structureUuid) {
		const previousStructures = [...structures];
		structures = structures.filter((s) => s.uuid !== structureUuid);

		try {
			const formData = new FormData();
			formData.append('structureUuid', structureUuid);

			const response = await fetch('?/deleteNodeStructure', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to delete structure');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_structure()
			});
		} catch (err) {
			structures = previousStructures;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_structure()
			});
		}
	}

	// Effects
	$effect(() => {
		if (selectedSlotConfigUuid) {
			fetchStructures();
		}
	});

	$effect(() => {
		const lastUpdated = sharedSlotState?.lastUpdated;
		if (lastUpdated && sharedSlotState?.slotConfigurations?.length > 0) {
			loading = false;
			const currentConfigStillExists = sharedSlotState.slotConfigurations.some(
				(c) => c.uuid === selectedSlotConfigUuid
			);
			if (!currentConfigStillExists && sharedSlotState.slotConfigurations.length > 0) {
				selectedSlotConfigUuid = sharedSlotState.slotConfigurations[0].uuid;
			} else if (!selectedSlotConfigUuid && sharedSlotState.slotConfigurations.length > 0) {
				selectedSlotConfigUuid = sharedSlotState.slotConfigurations[0].uuid;
			}
		}
	});

	onMount(() => {
		fetchSlotConfigurations();
	});
</script>

<div class="flex h-full">
	<!-- Component Sidebar -->
	<ComponentTypeSidebar onDragStart={handleSidebarDragStart} onDragEnd={handleSidebarDragEnd} />

	<!-- Main content -->
	<div class="flex-1 flex flex-col gap-4 p-4 min-w-0">
		<!-- Header with container info and side selector -->
		<div class="space-y-3">
			{#if containerPath}
				<div class="text-sm text-surface-500">
					<span class="font-medium">{m.form_container_path()}:</span>
					{containerPath}
				</div>
			{/if}

			<div class="flex items-center gap-3">
				<label class="label flex-1">
					<span class="text-sm font-medium">{m.form_select_side()}</span>
					<select class="select" value={selectedSlotConfigUuid} onchange={handleSideChange}>
						{#each slotConfigurations as config (config.uuid)}
							<option value={config.uuid}>{config.side}</option>
						{/each}
					</select>
				</label>

				{#if selectedConfig}
					<div class="text-sm text-surface-500 pt-5">
						{m.form_total_slots()}: {selectedConfig.total_slots}
					</div>
				{/if}
			</div>
		</div>

		<!-- Slot Grid -->
		<div
			class="flex-1 overflow-auto border border-surface-200-800 rounded-lg"
			ondragleave={handleGridDragLeave}
			role="list"
		>
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<span class="text-surface-500">{m.common_loading()}</span>
				</div>
			{:else if slotConfigurations.length === 0}
				<div class="flex items-center justify-center py-8">
					<span class="text-surface-500">{m.message_no_slot_configurations()}</span>
				</div>
			{:else if loadingStructures}
				<div class="flex items-center justify-center py-8">
					<span class="text-surface-500">{m.common_loading()}</span>
				</div>
			{:else}
				<div class="slot-grid" class:dragging={isDragging}>
					<!-- Header row -->
					<div class="grid-header">{m.form_tpu()}</div>
					<div class="grid-header">{m.form_component()}</div>
					<div class="grid-header">{m.form_clip_number()}</div>

					<!-- Slot rows -->
					{#each slotRows as row (row.slotNumber)}
						<!-- TPU number cell -->
						<div
							class="slot-number"
							class:drop-target={row.isDropTarget}
							class:occupied={row.isOccupied && !row.isDropTarget}
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
							ondragover={(e) => handleSlotDragOver(e, row.slotNumber)}
							ondragleave={handleSlotDragLeave}
							ondrop={(e) => handleSlotDrop(e, row.slotNumber)}
							role="listitem"
						>
							{#if row.isBlockStart && row.structure}
								<div
									class="structure-block group"
									style:--row-height="{row.blockSize * 36}px"
									draggable="true"
									ondragstart={(e) => handleStructureDragStart(e, row.structure)}
									ondragend={handleSidebarDragEnd}
									role="button"
									tabindex="0"
								>
									<IconGripVertical size={14} class="cursor-grab text-surface-400 flex-shrink-0" />
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
										class="delete-btn opacity-0 group-hover:opacity-100"
										onclick={(e) => {
											e.stopPropagation();
											handleDeleteStructure(row.structure.uuid);
										}}
									>
										<IconTrash size={14} />
									</button>
								</div>
							{:else if !row.isOccupied}
								<span class="text-surface-400 text-sm">-</span>
							{/if}
						</div>

						<!-- Clip number cell -->
						<div
							class="slot-clip"
							class:drop-target={row.isDropTarget}
							class:occupied={row.isOccupied && !row.isDropTarget}
						>
							{#if row.structure}
								{row.structure.clip_number ?? row.slotNumber}
							{:else}
								<span class="text-surface-400">{row.slotNumber}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.slot-grid {
		display: grid;
		grid-template-columns: 60px 1fr 60px;
		background: rgb(var(--color-surface-50));
	}

	.grid-header {
		padding: 8px 12px;
		font-weight: 600;
		font-size: 0.875rem;
		background: rgb(var(--color-surface-100));
		position: sticky;
		top: 0;
		z-index: 10;
		border-bottom: 1px solid rgb(var(--color-surface-200));
	}

	.slot-number,
	.slot-clip {
		padding: 8px 12px;
		font-family: monospace;
		text-align: center;
		background: rgb(var(--color-surface-50));
		border-bottom: 1px solid rgb(var(--color-surface-200));
		transition: background-color 0.15s;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.slot-content {
		padding: 2px 8px;
		min-height: 36px;
		background: rgb(var(--color-surface-50));
		border-bottom: 1px solid rgb(var(--color-surface-200));
		display: flex;
		align-items: center;
		transition:
			background-color 0.15s,
			outline 0.15s;
	}

	.slot-content.drop-target.can-drop {
		background: rgba(59, 130, 246, 0.1);
		outline: 2px dashed rgb(59, 130, 246);
		outline-offset: -2px;
	}

	.slot-content.drop-target.cannot-drop {
		background: rgba(239, 68, 68, 0.1);
		outline: 2px dashed rgb(239, 68, 68);
		outline-offset: -2px;
	}

	.slot-number.drop-target,
	.slot-clip.drop-target {
		background: rgba(59, 130, 246, 0.15);
	}

	.slot-number.occupied,
	.slot-clip.occupied {
		background: rgb(var(--color-primary-50));
	}

	.structure-block {
		width: 100%;
		height: var(--row-height, 32px);
		padding: 4px 8px;
		background: rgb(var(--color-primary-100));
		border: 1px solid rgb(var(--color-primary-300));
		border-radius: 4px;
		cursor: grab;
		display: flex;
		align-items: center;
		gap: 6px;
		position: relative;
		transition:
			background-color 0.15s,
			transform 0.1s;
	}

	.structure-block:hover {
		background: rgb(var(--color-primary-200));
	}

	.structure-block:active {
		cursor: grabbing;
		transform: scale(0.98);
	}

	.delete-btn {
		padding: 4px;
		background: rgb(var(--color-error-500));
		color: white;
		border-radius: 4px;
		transition: opacity 0.15s;
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
</style>
