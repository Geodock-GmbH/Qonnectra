<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { IconGripVertical, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	import CableFiberSidebar from './CableFiberSidebar.svelte';
	import ComponentTypeSidebar from './ComponentTypeSidebar.svelte';

	let {
		nodeUuid,
		nodeName = '',
		initialSlotConfigUuid = null,
		sharedSlotState = $bindable(null)
	} = $props();

	// State
	let localSlotConfigurations = $state([]);
	let selectedSlotConfigUuid = $state(initialSlotConfigUuid);
	let structures = $state([]);
	let loading = $state(true);
	let loadingStructures = $state(false);

	// Dividers and clip numbers state
	let dividers = $state([]);
	let clipNumbers = $state(new Map());
	let editingClipSlot = $state(null);
	let editingClipValue = $state('');

	// Drag state
	let isDragging = $state(false);
	let draggedItem = $state(null);
	let dropPreviewSlots = $state([]);

	// Refresh trigger for CableFiberSidebar - increments on mount to trigger refresh
	let cableRefreshTrigger = $state(0);

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

	// Compute divider positions as a Set for fast lookup
	const dividerAfterSlots = $derived.by(() => {
		// Access length to ensure reactivity is tracked
		const len = dividers.length;
		return new Set(dividers.map((d) => d.after_slot));
	});

	// Slot grid data
	const slotRows = $derived.by(() => {
		if (!selectedConfig) return [];
		// Access these at the top to ensure reactivity tracking
		const currentDividers = dividerAfterSlots;
		const currentClipNumbers = clipNumbers;
		const currentOccupied = occupiedSlots;
		const currentDropPreview = dropPreviewSlots;

		const rows = [];
		for (let slot = 1; slot <= selectedConfig.total_slots; slot++) {
			const structure = structures.find((s) => s.slot_start <= slot && s.slot_end >= slot);
			rows.push({
				slotNumber: slot,
				structure,
				isBlockStart: structure?.slot_start === slot,
				blockSize: structure ? structure.slot_end - structure.slot_start + 1 : 0,
				isOccupied: currentOccupied.has(slot),
				isDropTarget: currentDropPreview.includes(slot),
				hasDividerAfter: currentDividers.has(slot),
				clipNumber: currentClipNumbers.get(slot) || null
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
	 * Fetch dividers for the selected slot configuration
	 */
	async function fetchDividers() {
		if (!selectedSlotConfigUuid) {
			dividers = [];
			return;
		}

		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', selectedSlotConfigUuid);

			const response = await fetch('?/getSlotDividers', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch dividers');
			}

			dividers = result.data?.dividers || [];
		} catch (err) {
			console.error('Error fetching dividers:', err);
			dividers = [];
		}
	}

	/**
	 * Fetch clip numbers for the selected slot configuration
	 */
	async function fetchClipNumbers() {
		if (!selectedSlotConfigUuid) {
			clipNumbers = new Map();
			return;
		}

		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', selectedSlotConfigUuid);

			const response = await fetch('?/getSlotClipNumbers', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch clip numbers');
			}

			const clips = result.data?.clipNumbers || [];
			const newMap = new Map();
			for (const clip of clips) {
				newMap.set(clip.slot_number, clip.clip_number);
			}
			clipNumbers = newMap;
		} catch (err) {
			console.error('Error fetching clip numbers:', err);
			clipNumbers = new Map();
		}
	}

	/**
	 * Handle side selection change
	 */
	function handleSideChange(e) {
		selectedSlotConfigUuid = e.target.value;
	}

	/**
	 * Start editing a clip number
	 */
	function startEditingClip(slotNumber, currentValue) {
		editingClipSlot = slotNumber;
		editingClipValue = currentValue || String(slotNumber);
	}

	/**
	 * Save the edited clip number
	 */
	async function saveClipNumber() {
		if (editingClipSlot === null || !editingClipValue.trim()) {
			editingClipSlot = null;
			editingClipValue = '';
			return;
		}

		const slotNumber = editingClipSlot;
		const newClipNumber = editingClipValue.trim();

		// Optimistic update
		const previousClipNumbers = new Map(clipNumbers);
		clipNumbers.set(slotNumber, newClipNumber);
		clipNumbers = new Map(clipNumbers); // Trigger reactivity

		editingClipSlot = null;
		editingClipValue = '';

		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', selectedSlotConfigUuid);
			formData.append('slotNumber', slotNumber.toString());
			formData.append('clipNumber', newClipNumber);

			const response = await fetch('?/upsertSlotClipNumber', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to save clip number');
			}
		} catch (err) {
			console.error('Error saving clip number:', err);
			clipNumbers = previousClipNumbers;
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_saving_clip_number()
			});
		}
	}

	/**
	 * Handle clip number input keydown
	 */
	function handleClipKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveClipNumber();
		} else if (e.key === 'Escape') {
			editingClipSlot = null;
			editingClipValue = '';
		}
	}

	/**
	 * Toggle a divider after a slot
	 */
	async function toggleDivider(slotNumber) {
		const existingDivider = dividers.find((d) => d.after_slot === slotNumber);

		if (existingDivider) {
			// Delete the divider
			const previousDividers = [...dividers];
			dividers = dividers.filter((d) => d.uuid !== existingDivider.uuid);

			try {
				const formData = new FormData();
				formData.append('dividerUuid', existingDivider.uuid);

				const response = await fetch('?/deleteSlotDivider', {
					method: 'POST',
					body: formData
				});

				const result = deserialize(await response.text());

				if (result.type === 'failure' || result.type === 'error') {
					throw new Error(result.data?.error || 'Failed to delete divider');
				}
			} catch (err) {
				console.error('Error deleting divider:', err);
				dividers = previousDividers;
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_deleting_divider()
				});
			}
		} else {
			// Create a new divider
			const tempUuid = `temp-${Date.now()}`;
			const optimisticDivider = {
				uuid: tempUuid,
				slot_configuration: selectedSlotConfigUuid,
				after_slot: slotNumber
			};
			dividers = [...dividers, optimisticDivider];

			try {
				const formData = new FormData();
				formData.append('slotConfigUuid', selectedSlotConfigUuid);
				formData.append('afterSlot', slotNumber.toString());

				const response = await fetch('?/createSlotDivider', {
					method: 'POST',
					body: formData
				});

				const result = deserialize(await response.text());

				if (result.type === 'failure' || result.type === 'error') {
					throw new Error(result.data?.error || 'Failed to create divider');
				}

				// Replace temp with real divider
				dividers = dividers.map((d) => (d.uuid === tempUuid ? result.data.divider : d));
			} catch (err) {
				console.error('Error creating divider:', err);
				dividers = dividers.filter((d) => d.uuid !== tempUuid);
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_creating_divider()
				});
			}
		}
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

	// Cable/Fiber sidebar drag handlers
	function handleCableFiberDragStart(dragData) {
		isDragging = true;
		draggedItem = dragData;
	}

	function handleCableFiberDragEnd() {
		isDragging = false;
		draggedItem = null;
		dropPreviewSlots = [];
	}

	function handleStructureDragStart(e, structure) {
		const dragData = {
			type: 'existing_structure',
			uuid: structure.uuid,
			slot_start: structure.slot_start,
			slot_end: structure.slot_end,
			occupied_slots: structure.slot_end - structure.slot_start + 1
		};
		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'move';
		isDragging = true;
		draggedItem = dragData;
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
		// Use 'move' for existing structures, 'copy' for new components
		e.dataTransfer.dropEffect = canDrop
			? draggedItem?.type === 'existing_structure'
				? 'move'
				: 'copy'
			: 'none';
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
		dropPreviewSlots = [];
		isDragging = false;

		const jsonData = e.dataTransfer.getData('application/json');
		if (!jsonData) {
			draggedItem = null;
			return;
		}

		try {
			const data = JSON.parse(jsonData);

			if (data.type === 'component_type') {
				await createStructure(data, slotNumber);
			} else if (data.type === 'existing_structure') {
				// Skip if dropping on the same position
				if (data.slot_start === slotNumber) {
					draggedItem = null;
					return;
				}
				await moveStructure(data, slotNumber);
			}
		} catch (err) {
			console.error('Drop error:', err);
			globalToaster.error({
				title: m.common_error(),
				description: err.message || m.message_error_placing_component()
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

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_moving_component()
			});
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
			fetchDividers();
			fetchClipNumbers();
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
		// Trigger cable sidebar refresh when panel opens
		cableRefreshTrigger++;
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
		<div class="flex-1 flex flex-col border border-surface-200-800 rounded-lg overflow-hidden">
			<!-- Header row (outside scrollable area) -->
			<div class="slot-grid-header">
				<div class="grid-header">{m.form_tpu()}</div>
				<div class="grid-header">{m.form_component()}</div>
				<div class="grid-header">{m.form_clip_number()}</div>
			</div>

			<!-- Scrollable content -->
			<div class="flex-1 overflow-auto" ondragleave={handleGridDragLeave} role="list">
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
						<!-- Slot rows -->
						{#each slotRows as row (row.slotNumber)}
							<!-- TPU number cell -->
							<div
								class="slot-number"
								class:drop-target={row.isDropTarget}
								class:occupied={row.isOccupied && !row.isDropTarget}
								class:has-divider-after={row.hasDividerAfter}
								ondblclick={() => toggleDivider(row.slotNumber)}
								title={m.tooltip_double_click_divider()}
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
										<IconGripVertical
											size={14}
											class="cursor-grab text-surface-400 flex-shrink-0"
										/>
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
											<IconTrash size={16} class="text-surface-950-50" />
										</button>
									</div>
								{:else if !row.isOccupied}
									<span class="text-surface-400 text-sm">-</span>
								{/if}
							</div>

							<!-- Clip number cell (editable) -->
							<div
								class="slot-clip"
								class:drop-target={row.isDropTarget}
								class:occupied={row.isOccupied && !row.isDropTarget}
								class:has-divider-after={row.hasDividerAfter}
							>
								{#if editingClipSlot === row.slotNumber}
									<input
										type="text"
										class="clip-input"
										bind:value={editingClipValue}
										onblur={saveClipNumber}
										onkeydown={handleClipKeydown}
										autofocus
									/>
								{:else}
									<button
										type="button"
										class="clip-value"
										onclick={() => startEditingClip(row.slotNumber, row.clipNumber)}
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
	</div>

	<!-- Cable/Fiber Sidebar -->
	<CableFiberSidebar
		{nodeUuid}
		refreshTrigger={cableRefreshTrigger}
		onDragStart={handleCableFiberDragStart}
		onDragEnd={handleCableFiberDragEnd}
	/>
</div>

<style>
	.slot-grid-header {
		display: grid;
		grid-template-columns: 60px 1fr 60px;
		flex-shrink: 0;
	}

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
		position: relative;
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
		width: calc(100% - 4px);
		height: var(--row-height, 32px);
		padding: 4px 8px;
		background: rgb(var(--color-primary-100));
		border: 1px solid rgb(var(--color-primary-300));
		border-radius: 4px;
		cursor: grab;
		display: flex;
		align-items: center;
		gap: 6px;
		position: absolute;
		top: 2px;
		left: 2px;
		z-index: 5;
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

	/* Divider styles */
	.has-divider-after {
		border-bottom: 1px solid var(--color-surface-950-50) !important;
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
	}

	.clip-value:hover {
		background: rgba(var(--color-primary-500), 0.1);
		border-radius: 2px;
	}

	.clip-input {
		width: 100%;
		height: 24px;
		background: white;
		border: 2px solid rgb(var(--color-primary-500));
		border-radius: 2px;
		font-family: monospace;
		text-align: center;
		font-size: 0.875rem;
		padding: 0 4px;
		outline: none;
	}

	.clip-input:focus {
		box-shadow: 0 0 0 2px rgba(var(--color-primary-500), 0.2);
	}
</style>
