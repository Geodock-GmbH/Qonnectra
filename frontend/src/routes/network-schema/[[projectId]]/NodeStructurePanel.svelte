<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { IconLayoutList, IconPlug, IconTopologyRing2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	import CableFiberSidebar from './CableFiberSidebar.svelte';
	import ComponentTypeSidebar from './ComponentTypeSidebar.svelte';
	import MobileBottomSheet from './MobileBottomSheet.svelte';
	import PortTable from './PortTable.svelte';
	import SlotGrid from './SlotGrid.svelte';

	let {
		nodeUuid,
		nodeName = '',
		initialSlotConfigUuid = null,
		sharedSlotState = $bindable(null)
	} = $props();

	// Responsive state
	let innerWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
	const isMobile = $derived(innerWidth < 768);

	// Mobile-specific state
	let activeSheet = $state(null); // 'components' | 'cables' | 'ports' | null
	let mobileSelectedItem = $state(null);

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

	// Refresh trigger for CableFiberSidebar
	let cableRefreshTrigger = $state(0);

	// Port table state
	let selectedStructure = $state(null);
	let componentPorts = $state([]);
	let fiberSplices = $state([]);
	let loadingPorts = $state(false);
	let fiberColors = $state([]);

	// Track window resize
	function handleResize() {
		innerWidth = window.innerWidth;
	}

	// Clear mobile selection when switching to desktop
	$effect(() => {
		if (!isMobile) {
			mobileSelectedItem = null;
			activeSheet = null;
		}
	});

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
		const len = dividers.length;
		return new Set(dividers.map((d) => d.after_slot));
	});

	// Slot grid data
	const slotRows = $derived.by(() => {
		if (!selectedConfig) return [];
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

	// Build port rows from component ports and splices
	const portRows = $derived.by(() => {
		if (!componentPorts.length) return [];

		const inPorts = componentPorts.filter((p) => p.in_or_out === 'in');
		const outPorts = componentPorts.filter((p) => p.in_or_out === 'out');

		const maxInPort = inPorts.length > 0 ? Math.max(...inPorts.map((p) => p.port)) : 0;
		const maxOutPort = outPorts.length > 0 ? Math.max(...outPorts.map((p) => p.port)) : 0;
		const maxPort = Math.max(maxInPort, maxOutPort);

		const rows = [];
		for (let port = 1; port <= maxPort; port++) {
			const hasInPort = inPorts.some((p) => p.port === port);
			const hasOutPort = outPorts.some((p) => p.port === port);
			const splice = fiberSplices.find((s) => s.port_number === port);

			rows.push({
				portNumber: port,
				hasInPort,
				hasOutPort,
				splice,
				fiberA: splice?.fiber_a_details || null,
				fiberB: splice?.fiber_b_details || null
			});
		}
		return rows;
	});

	// ========== API Functions ==========

	async function fetchSlotConfigurations() {
		if (!nodeUuid) return;

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

	async function fetchComponentPorts(componentTypeId) {
		try {
			const formData = new FormData();
			formData.append('componentTypeId', componentTypeId.toString());

			const response = await fetch('?/getComponentPorts', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch component ports');
			}

			componentPorts = result.data?.ports || [];
		} catch (err) {
			console.error('Error fetching component ports:', err);
			componentPorts = [];
		}
	}

	async function fetchFiberSplices(nodeStructureUuid) {
		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', nodeStructureUuid);

			const response = await fetch('?/getFiberSplices', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch fiber splices');
			}

			fiberSplices = result.data?.splices || [];
		} catch (err) {
			console.error('Error fetching fiber splices:', err);
			fiberSplices = [];
		}
	}

	async function fetchFiberColorsIfNeeded() {
		if (fiberColors.length > 0) return;

		try {
			const response = await fetch('?/getFiberColors', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch fiber colors');
			}

			fiberColors = result.data?.fiberColors || [];
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
		}
	}

	// ========== Event Handlers ==========

	function handleSideChange(e) {
		selectedSlotConfigUuid = e.target.value;
	}

	function startEditingClip(slotNumber, currentValue) {
		editingClipSlot = slotNumber;
		editingClipValue = currentValue || String(slotNumber);
	}

	async function saveClipNumber() {
		if (editingClipSlot === null || !editingClipValue.trim()) {
			editingClipSlot = null;
			editingClipValue = '';
			return;
		}

		const slotNumber = editingClipSlot;
		const newClipNumber = editingClipValue.trim();

		const previousClipNumbers = new Map(clipNumbers);
		clipNumbers.set(slotNumber, newClipNumber);
		clipNumbers = new Map(clipNumbers);

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

	function handleClipKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveClipNumber();
		} else if (e.key === 'Escape') {
			editingClipSlot = null;
			editingClipValue = '';
		}
	}

	async function toggleDivider(slotNumber) {
		const existingDivider = dividers.find((d) => d.after_slot === slotNumber);

		if (existingDivider) {
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

	// ========== Drag Handlers ==========

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
			const occupyingStructureUuid = occupiedSlots.get(i);
			if (occupyingStructureUuid) {
				if (
					draggedItem?.type !== 'existing_structure' ||
					occupyingStructureUuid !== draggedItem?.uuid
				) {
					canDrop = false;
				}
			}
		}

		if (preview.length < occupiedSlotsCount) {
			canDrop = false;
		}

		dropPreviewSlots = preview;
		e.dataTransfer.dropEffect = canDrop
			? draggedItem?.type === 'existing_structure'
				? 'move'
				: 'copy'
			: 'none';
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

	// ========== Mobile Handlers ==========

	function handleMobileComponentSelect(componentType) {
		mobileSelectedItem = {
			type: 'component_type',
			id: componentType.id,
			name: componentType.component_type,
			occupied_slots: componentType.occupied_slots
		};
		activeSheet = null;
	}

	async function handleMobileSlotTap(slotNumber) {
		if (!mobileSelectedItem) return;

		try {
			await createStructure(mobileSelectedItem, slotNumber);
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: err.message || m.message_error_placing_component()
			});
		}

		mobileSelectedItem = null;
	}

	function handleMobileFiberSelect(fiberData) {
		mobileSelectedItem = fiberData;
		activeSheet = 'ports';
	}

	// ========== Structure CRUD ==========

	async function createStructure(componentData, slotStart) {
		const slotEnd = slotStart + componentData.occupied_slots - 1;

		if (slotEnd > selectedConfig.total_slots) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_not_enough_slots()
			});
			return;
		}

		for (let i = slotStart; i <= slotEnd; i++) {
			if (occupiedSlots.has(i)) {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_slots_occupied()
				});
				return;
			}
		}

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

			structures = structures.map((s) => (s.uuid === tempUuid ? result.data.structure : s));

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_placing_component()
			});
		} catch (err) {
			structures = structures.filter((s) => s.uuid !== tempUuid);
			throw err;
		}
	}

	async function moveStructure(structureData, newSlotStart) {
		const slotCount = structureData.occupied_slots;
		const newSlotEnd = newSlotStart + slotCount - 1;

		if (newSlotEnd > selectedConfig.total_slots) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_not_enough_slots()
			});
			return;
		}

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

			structures = structures.map((s) =>
				s.uuid === structureData.uuid ? result.data.structure : s
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_moving_component()
			});
		} catch (err) {
			structures = previousStructures;
			throw err;
		}
	}

	async function handleDeleteStructure(structureUuid) {
		const previousStructures = [...structures];
		structures = structures.filter((s) => s.uuid !== structureUuid);

		// Clear selection if deleted structure was selected
		if (selectedStructure?.uuid === structureUuid) {
			selectedStructure = null;
			componentPorts = [];
			fiberSplices = [];
		}

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

	// ========== Structure Selection / Port Table ==========

	async function selectStructure(structure) {
		if (selectedStructure?.uuid === structure?.uuid) {
			selectedStructure = null;
			componentPorts = [];
			fiberSplices = [];
			return;
		}

		selectedStructure = structure;
		if (!structure?.component_type?.id) {
			componentPorts = [];
			fiberSplices = [];
			return;
		}

		loadingPorts = true;
		try {
			await Promise.all([
				fetchComponentPorts(structure.component_type.id),
				fetchFiberSplices(structure.uuid),
				fetchFiberColorsIfNeeded()
			]);
		} finally {
			loadingPorts = false;
		}

		// On mobile, open ports sheet
		if (isMobile) {
			activeSheet = 'ports';
		}
	}

	async function handlePortDrop(portNumber, side, fiberData) {
		if (fiberData.type !== 'fiber') {
			globalToaster.warning({
				title: m.common_warning?.() || 'Warning',
				description:
					m.message_only_fibers_allowed?.() || 'Only individual fibers can be connected to ports'
			});
			return;
		}

		const previousSplices = [...fiberSplices];
		const existingSplice = fiberSplices.find((s) => s.port_number === portNumber);

		const fiberDetails = {
			uuid: fiberData.uuid,
			fiber_number: fiberData.fiber_number,
			fiber_color: fiberData.fiber_color,
			bundle_number: fiberData.bundle_number,
			cable_name: fiberData.cable_name
		};

		if (existingSplice) {
			fiberSplices = fiberSplices.map((s) => {
				if (s.port_number === portNumber) {
					return {
						...s,
						[`fiber_${side}_details`]: fiberDetails
					};
				}
				return s;
			});
		} else {
			const newSplice = {
				uuid: `temp-${Date.now()}`,
				port_number: portNumber,
				fiber_a_details: side === 'a' ? fiberDetails : null,
				fiber_b_details: side === 'b' ? fiberDetails : null
			};
			fiberSplices = [...fiberSplices, newSplice];
		}

		// Clear mobile selection after placing
		if (isMobile && mobileSelectedItem?.type === 'fiber') {
			mobileSelectedItem = null;
		}

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', selectedStructure.uuid);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);
			formData.append('fiberUuid', fiberData.uuid);
			formData.append('cableUuid', fiberData.cable_uuid);

			const response = await fetch('?/upsertFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to save fiber splice');
			}

			const serverSplice = result.data.splice;
			fiberSplices = fiberSplices.map((s) => (s.port_number === portNumber ? serverSplice : s));

			globalToaster.success({
				title: m.title_success(),
				description: m.message_fiber_connected?.() || 'Fiber connected successfully'
			});
		} catch (err) {
			console.error('Error saving fiber splice:', err);
			fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description:
					err.message || m.message_error_connecting_fiber?.() || 'Failed to connect fiber'
			});
		}
	}

	async function handleClearPort(portNumber, side) {
		const previousSplices = [...fiberSplices];

		fiberSplices = fiberSplices
			.map((s) => {
				if (s.port_number === portNumber) {
					const updated = {
						...s,
						[`fiber_${side}_details`]: null
					};
					if (!updated.fiber_a_details && !updated.fiber_b_details) {
						return null;
					}
					return updated;
				}
				return s;
			})
			.filter(Boolean);

		try {
			const formData = new FormData();
			formData.append('nodeStructureUuid', selectedStructure.uuid);
			formData.append('portNumber', portNumber.toString());
			formData.append('side', side);

			const response = await fetch('?/clearFiberSplice', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to clear fiber splice');
			}
		} catch (err) {
			console.error('Error clearing fiber splice:', err);
			fiberSplices = previousSplices;
			globalToaster.error({
				title: m.common_error(),
				description: err.message || 'Failed to clear fiber'
			});
		}
	}

	function handleClosePortTable() {
		selectedStructure = null;
		componentPorts = [];
		fiberSplices = [];
	}

	// ========== Effects ==========

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
		cableRefreshTrigger++;

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);
			return () => window.removeEventListener('resize', handleResize);
		}
	});
</script>

<div class="flex flex-col h-full">
	{#if isMobile}
		<!-- ========== MOBILE LAYOUT ========== -->
		<div class="flex flex-col h-full pb-16">
			<!-- Header -->
			<div class="flex-shrink-0 p-3 border-b border-surface-200-800 bg-surface-100-900">
				{#if containerPath}
					<div class="text-xs text-surface-500 mb-1">
						{containerPath}
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<select
						class="select flex-1 text-sm"
						value={selectedSlotConfigUuid}
						onchange={handleSideChange}
					>
						{#each slotConfigurations as config (config.uuid)}
							<option value={config.uuid}>{config.side}</option>
						{/each}
					</select>
					{#if selectedConfig}
						<span class="text-xs text-surface-500 whitespace-nowrap">
							{selectedConfig.total_slots}
							{m.form_slots?.() || 'Slots'}
						</span>
					{/if}
				</div>
				{#if mobileSelectedItem}
					<div
						class="mt-2 px-3 py-2 bg-primary-100 dark:bg-primary-900 rounded-lg text-sm flex items-center justify-between"
					>
						<span class="font-medium">{mobileSelectedItem.name}</span>
						<button
							type="button"
							class="text-xs text-primary-600 dark:text-primary-400"
							onclick={() => (mobileSelectedItem = null)}
						>
							{m.common_cancel?.() || 'Cancel'}
						</button>
					</div>
				{/if}
			</div>

			<!-- Slot Grid -->
			<div class="flex-1 overflow-hidden p-3">
				<SlotGrid
					{slotRows}
					{structures}
					{selectedStructure}
					{isDragging}
					{draggedItem}
					bind:dropPreviewSlots
					{occupiedSlots}
					{loading}
					{loadingStructures}
					{isMobile}
					{mobileSelectedItem}
					onSlotTap={handleMobileSlotTap}
					onStructureSelect={selectStructure}
					onStructureDelete={handleDeleteStructure}
					onToggleDivider={toggleDivider}
					onStartEditingClip={startEditingClip}
					{editingClipSlot}
					bind:editingClipValue
					onSaveClipNumber={saveClipNumber}
					onClipKeydown={handleClipKeydown}
				/>
			</div>

			<!-- Mobile Bottom Tabs -->
			<div
				class="fixed bottom-0 left-0 right-0 z-30
				       bg-surface-100-900 border-t border-surface-200-800"
			>
				<div class="grid grid-cols-3 gap-1 p-2">
					<button
						type="button"
						class="btn flex-col gap-1 py-2 text-xs {activeSheet === 'components'
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeSheet = activeSheet === 'components' ? null : 'components')}
					>
						<IconLayoutList size={20} />
						<span>{m.form_components?.() || 'Components'}</span>
					</button>
					<button
						type="button"
						class="btn flex-col gap-1 py-2 text-xs {activeSheet === 'cables'
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeSheet = activeSheet === 'cables' ? null : 'cables')}
					>
						<IconTopologyRing2 size={20} />
						<span>{m.form_cables()}</span>
					</button>
					<button
						type="button"
						class="btn flex-col gap-1 py-2 text-xs {activeSheet === 'ports'
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeSheet = activeSheet === 'ports' ? null : 'ports')}
						disabled={!selectedStructure}
					>
						<IconPlug size={20} />
						<span>{m.form_ports?.() || 'Ports'}</span>
					</button>
				</div>
			</div>

			<!-- Mobile Bottom Sheets -->
			<MobileBottomSheet
				bind:open={activeSheet}
				title={activeSheet === 'components'
					? m.form_component_types()
					: activeSheet === 'cables'
						? m.form_cables()
						: m.form_ports?.() || 'Ports'}
			>
				{#if activeSheet === 'components'}
					<ComponentTypeSidebar
						onDragStart={handleSidebarDragStart}
						onDragEnd={handleSidebarDragEnd}
						{isMobile}
						onMobileSelect={handleMobileComponentSelect}
					/>
				{:else if activeSheet === 'cables'}
					<CableFiberSidebar
						{nodeUuid}
						refreshTrigger={cableRefreshTrigger}
						onDragStart={handleCableFiberDragStart}
						onDragEnd={handleCableFiberDragEnd}
						{isMobile}
						onMobileSelect={handleMobileFiberSelect}
					/>
				{:else if activeSheet === 'ports' && selectedStructure}
					<PortTable
						structureName={selectedStructure.component_type?.component_type || '-'}
						{portRows}
						{fiberColors}
						loading={loadingPorts}
						onPortDrop={handlePortDrop}
						onClearPort={handleClearPort}
						onClose={handleClosePortTable}
					/>
				{/if}
			</MobileBottomSheet>
		</div>
	{:else}
		<!-- ========== DESKTOP LAYOUT ========== -->
		<div class="flex h-full">
			<!-- Left Sidebar: Component Types -->
			<ComponentTypeSidebar onDragStart={handleSidebarDragStart} onDragEnd={handleSidebarDragEnd} />

			<!-- Main Content -->
			<div class="flex-1 flex flex-col gap-4 p-4 min-w-0 overflow-hidden">
				<!-- Header -->
				<div class="flex-shrink-0 space-y-3">
					{#if containerPath}
						<div class="text-sm text-surface-500">
							<span class="font-medium">{m.form_container_path?.() || 'Container'}:</span>
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
				<SlotGrid
					{slotRows}
					{structures}
					{selectedStructure}
					{isDragging}
					{draggedItem}
					bind:dropPreviewSlots
					{occupiedSlots}
					{loading}
					{loadingStructures}
					{isMobile}
					onSlotDragOver={handleSlotDragOver}
					onSlotDrop={handleSlotDrop}
					onStructureDragStart={handleStructureDragStart}
					onStructureDragEnd={handleSidebarDragEnd}
					onStructureSelect={selectStructure}
					onStructureDelete={handleDeleteStructure}
					onToggleDivider={toggleDivider}
					onStartEditingClip={startEditingClip}
					{editingClipSlot}
					bind:editingClipValue
					onSaveClipNumber={saveClipNumber}
					onClipKeydown={handleClipKeydown}
				/>

				<!-- Port Table (when structure selected) -->
				{#if selectedStructure}
					<div class="flex-shrink-0">
						<PortTable
							structureName={selectedStructure.component_type?.component_type || '-'}
							{portRows}
							{fiberColors}
							loading={loadingPorts}
							onPortDrop={handlePortDrop}
							onClearPort={handleClearPort}
							onClose={handleClosePortTable}
						/>
					</div>
				{/if}
			</div>

			<!-- Right Sidebar: Cables/Fibers -->
			<CableFiberSidebar
				{nodeUuid}
				refreshTrigger={cableRefreshTrigger}
				onDragStart={handleCableFiberDragStart}
				onDragEnd={handleCableFiberDragEnd}
			/>
		</div>
	{/if}
</div>
