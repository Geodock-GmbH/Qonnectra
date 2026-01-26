import { m } from '$lib/paraglide/messages';

/**
 * Manager for drag-and-drop state across components.
 * Shared via context for coordinated drag-drop between sidebars and grid.
 */
export class DragDropManager {
	/** @type {boolean} */
	isDragging = $state(false);

	/** @type {Object|null} */
	draggedItem = $state(null);

	/** @type {Array<number>} */
	dropPreviewSlots = $state([]);

	/** @type {Object|null} - Mobile selection item */
	mobileSelectedItem = $state(null);

	/** @type {Array<{start: number, end: number}>} - Component boundaries for multi-drop preview */
	componentRanges = $state([]);

	/**
	 * Start a drag operation
	 * @param {Object} item - The item being dragged
	 */
	startDrag(item) {
		this.isDragging = true;
		this.draggedItem = item;
	}

	/**
	 * End a drag operation
	 */
	endDrag() {
		this.isDragging = false;
		this.draggedItem = null;
		this.dropPreviewSlots = [];
		this.componentRanges = [];
	}

	/**
	 * Start dragging a component type from sidebar
	 * @param {Object} componentType
	 */
	startComponentDrag(componentType) {
		this.startDrag({
			type: 'component_type',
			id: componentType.id,
			name: componentType.component_type,
			occupied_slots: componentType.occupied_slots
		});
	}

	/**
	 * Start dragging multiple components of the same type
	 * @param {Object} componentType
	 * @param {number} count - Number of components to place
	 */
	startMultiComponentDrag(componentType, count) {
		this.startDrag({
			type: 'multi_component_type',
			id: componentType.id,
			name: componentType.component_type,
			occupied_slots: componentType.occupied_slots,
			count: count,
			total_slots: componentType.occupied_slots * count
		});
	}

	/**
	 * Start dragging an existing structure
	 * @param {Event} e - Drag event
	 * @param {Object} structure
	 */
	startStructureDrag(e, structure) {
		const dragData = {
			type: 'existing_structure',
			uuid: structure.uuid,
			slot_start: structure.slot_start,
			slot_end: structure.slot_end,
			occupied_slots: structure.slot_end - structure.slot_start + 1
		};
		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'move';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a cable
	 * @param {Event} e - Drag event
	 * @param {Object} cable
	 * @param {Array<Object>|null} fibers - Optional pre-loaded fibers array
	 */
	startCableDrag(e, cable, fibers = null) {
		const dragData = {
			type: 'cable',
			uuid: cable.uuid,
			name: cable.name,
			fiber_count: cable.fiber_count,
			direction: cable.direction,
			fibers: fibers
				? fibers.map((f) => ({
						uuid: f.uuid,
						fiber_number_absolute: f.fiber_number_absolute,
						fiber_number_in_bundle: f.fiber_number_in_bundle,
						fiber_color: f.fiber_color,
						bundle_number: f.bundle_number,
						bundle_color: f.bundle_color
					}))
				: null
		};
		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a bundle
	 * @param {Event} e - Drag event
	 * @param {Object} cable
	 * @param {Object} bundle
	 */
	startBundleDrag(e, cable, bundle) {
		e.stopPropagation();
		// Include fibers array for multi-fiber drop functionality
		const fibers = bundle.fibers.map((f) => ({
			uuid: f.uuid,
			fiber_number_absolute: f.fiber_number_absolute,
			fiber_number_in_bundle: f.fiber_number_in_bundle,
			fiber_color: f.fiber_color,
			bundle_number: f.bundle_number
		}));
		const dragData = {
			type: 'bundle',
			cable_uuid: cable.uuid,
			cable_name: cable.name,
			bundle_number: bundle.bundleNumber,
			bundle_color: bundle.bundleColor,
			fiber_count: bundle.fibers.length,
			fibers
		};
		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a fiber
	 * @param {Event} e - Drag event
	 * @param {Object} cable
	 * @param {Object} bundle
	 * @param {Object} fiber
	 */
	startFiberDrag(e, cable, bundle, fiber) {
		e.stopPropagation();
		const dragData = {
			type: 'fiber',
			uuid: fiber.uuid,
			cable_uuid: cable.uuid,
			cable_name: cable.name,
			bundle_number: fiber.bundle_number,
			fiber_number: fiber.fiber_number_absolute,
			fiber_color: fiber.fiber_color
		};
		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Update drop preview for slot grid
	 * @param {number} slotNumber - Target slot number
	 * @param {number} totalSlots - Total slots in config
	 * @param {Map<number, string>} occupiedSlots - Map of occupied slots
	 * @returns {{preview: Array<number>, canDrop: boolean, componentRanges: Array<{start: number, end: number}>}}
	 */
	updateDropPreview(slotNumber, totalSlots, occupiedSlots) {
		const isMulti = this.draggedItem?.type === 'multi_component_type';
		const singleOccupied = this.draggedItem?.occupied_slots || 1;
		const count = isMulti ? this.draggedItem?.count || 1 : 1;
		const occupiedSlotsCount = isMulti
			? this.draggedItem?.total_slots || singleOccupied
			: singleOccupied;
		const previewEnd = Math.min(slotNumber + occupiedSlotsCount - 1, totalSlots);
		const preview = [];
		const componentRanges = [];
		let canDrop = true;

		for (let i = slotNumber; i <= previewEnd; i++) {
			preview.push(i);
			const occupyingStructureUuid = occupiedSlots.get(i);
			if (occupyingStructureUuid) {
				if (
					this.draggedItem?.type !== 'existing_structure' ||
					occupyingStructureUuid !== this.draggedItem?.uuid
				) {
					canDrop = false;
				}
			}
		}

		if (preview.length < occupiedSlotsCount) {
			canDrop = false;
		}

		// Calculate component ranges for visual feedback
		if (canDrop && isMulti) {
			for (let c = 0; c < count; c++) {
				const start = slotNumber + c * singleOccupied;
				const end = start + singleOccupied - 1;
				componentRanges.push({ start, end });
			}
		} else if (canDrop) {
			componentRanges.push({ start: slotNumber, end: slotNumber + singleOccupied - 1 });
		}

		this.dropPreviewSlots = preview;
		this.componentRanges = componentRanges;
		return { preview, canDrop, componentRanges };
	}

	/**
	 * Clear drop preview
	 */
	clearDropPreview() {
		this.dropPreviewSlots = [];
		this.componentRanges = [];
	}

	/**
	 * Validate if a drop is allowed at a slot
	 * @param {number} slotNumber
	 * @param {Map<number, string>} occupiedSlots
	 * @returns {boolean}
	 */
	validateDropTarget(slotNumber, occupiedSlots) {
		const occupyingUuid = occupiedSlots.get(slotNumber);
		if (!occupyingUuid) return true;
		if (
			this.draggedItem?.type === 'existing_structure' &&
			occupyingUuid === this.draggedItem?.uuid
		) {
			return true;
		}
		return false;
	}

	/**
	 * Get drop effect based on drag type
	 * @param {boolean} canDrop
	 * @returns {'copy'|'move'|'none'}
	 */
	getDropEffect(canDrop) {
		if (!canDrop) return 'none';
		return this.draggedItem?.type === 'existing_structure' ? 'move' : 'copy';
	}

	/**
	 * Parse drop data from a drop event
	 * @param {DragEvent} e
	 * @returns {Object|null}
	 */
	parseDropData(e) {
		const jsonData = e.dataTransfer.getData('application/json');
		if (!jsonData) return null;
		try {
			return JSON.parse(jsonData);
		} catch {
			return null;
		}
	}

	/**
	 * Select an item for mobile (tap-to-place mode)
	 * @param {Object} item
	 */
	selectMobileItem(item) {
		this.mobileSelectedItem = item;
	}

	/**
	 * Select a component for mobile placement
	 * @param {Object} componentType
	 * @param {number} count - Number of components (default 1)
	 */
	selectMobileComponent(componentType, count = 1) {
		if (count > 1) {
			this.mobileSelectedItem = {
				type: 'multi_component_type',
				id: componentType.id,
				name: componentType.component_type,
				occupied_slots: componentType.occupied_slots,
				count: count,
				total_slots: componentType.occupied_slots * count
			};
		} else {
			this.mobileSelectedItem = {
				type: 'component_type',
				id: componentType.id,
				name: componentType.component_type,
				occupied_slots: componentType.occupied_slots
			};
		}
	}

	/**
	 * Select a fiber for mobile placement
	 * @param {Object} cable
	 * @param {Object} bundle
	 * @param {Object} fiber
	 */
	selectMobileFiber(cable, bundle, fiber) {
		this.mobileSelectedItem = {
			type: 'fiber',
			uuid: fiber.uuid,
			cable_uuid: cable.uuid,
			cable_name: cable.name,
			bundle_number: fiber.bundle_number,
			fiber_number: fiber.fiber_number_absolute,
			fiber_color: fiber.fiber_color,
			name: `${cable.name} - ${m.form_fiber()} ${fiber.fiber_number_absolute}`
		};
	}

	/**
	 * Clear mobile selection
	 */
	clearMobileSelection() {
		this.mobileSelectedItem = null;
	}

	/**
	 * Clear mobile selection when switching to desktop
	 * @param {boolean} isMobile
	 */
	handleResponsiveChange(isMobile) {
		if (!isMobile) {
			this.mobileSelectedItem = null;
		}
	}

	/**
	 * Cleanup manager state
	 */
	cleanup() {
		this.isDragging = false;
		this.draggedItem = null;
		this.dropPreviewSlots = [];
		this.componentRanges = [];
		this.mobileSelectedItem = null;
	}
}

/** Context key for DragDropManager */
export const DRAG_DROP_CONTEXT_KEY = 'dragDropManager';
