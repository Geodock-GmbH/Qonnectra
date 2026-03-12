import { m } from '$lib/paraglide/messages';

/**
 * @typedef {{
 *   id: number,
 *   component_type: string,
 *   occupied_slots: number
 * }} ComponentType
 *
 * @typedef {{
 *   uuid: string,
 *   slot_start: number,
 *   slot_end: number
 * }} Structure
 *
 * @typedef {{
 *   uuid: string,
 *   name: string,
 *   fiber_count?: number,
 *   direction?: string
 * }} Cable
 *
 * @typedef {{
 *   uuid: string,
 *   fiber_number_absolute: number,
 *   fiber_number_in_bundle: number,
 *   fiber_color: string,
 *   bundle_number: number,
 *   bundle_color?: string
 * }} Fiber
 *
 * @typedef {{
 *   bundleNumber: number,
 *   bundleColor: string,
 *   fibers: Fiber[]
 * }} Bundle
 *
 * @typedef {{
 *   uuid: string,
 *   street: string,
 *   housenumber: string,
 *   house_number_suffix?: string
 * }} Address
 *
 * @typedef {{
 *   uuid: string,
 *   id_residential_unit?: string,
 *   external_id_1?: string,
 *   external_id_2?: string,
 *   floor?: string,
 *   side?: string,
 *   resident_name?: string
 * }} ResidentialUnit
 *
 * @typedef {{
 *   type: string,
 *   id?: number,
 *   uuid?: string,
 *   name?: string,
 *   occupied_slots?: number,
 *   count?: number,
 *   total_slots?: number,
 *   slot_start?: number,
 *   slot_end?: number,
 *   cable_uuid?: string,
 *   cable_name?: string,
 *   bundle_number?: number,
 *   fiber_number?: number,
 *   fiber_color?: string,
 *   fiber_count?: number,
 *   direction?: string,
 *   fibers?: DragFiber[]|null,
 *   address_uuid?: string,
 *   address_display?: string,
 *   id_residential_unit?: string,
 *   display_name?: string,
 *   resident_name?: string,
 *   bundle_color?: string,
 *   unit_count?: number,
 *   residential_units?: DragResidentialUnit[]
 * }} DragItem
 *
 * @typedef {{
 *   uuid: string,
 *   fiber_number_absolute: number,
 *   fiber_number_in_bundle: number,
 *   fiber_color: string,
 *   bundle_number: number,
 *   bundle_color?: string
 * }} DragFiber
 *
 * @typedef {{
 *   uuid: string,
 *   id_residential_unit?: string,
 *   external_id_1?: string,
 *   external_id_2?: string,
 *   floor?: string,
 *   side?: string,
 *   resident_name?: string
 * }} DragResidentialUnit
 *
 * @typedef {{ start: number, end: number }} SlotRange
 */

/**
 * Manager for drag-and-drop state across components.
 * Shared via context for coordinated drag-drop between sidebars and grid.
 */
export class DragDropManager {
	/** @type {boolean} */
	isDragging = $state(false);

	/** @type {DragItem|null} */
	draggedItem = $state(null);

	/** @type {number[]} */
	dropPreviewSlots = $state([]);

	/** @type {DragItem|null} */
	mobileSelectedItem = $state(null);

	/** @type {SlotRange[]} */
	componentRanges = $state([]);

	/**
	 * Start a drag operation
	 * @param {DragItem} item - The item being dragged
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
	 * @param {ComponentType} componentType
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
	 * @param {ComponentType} componentType
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
	 * @param {DragEvent} e - Drag event
	 * @param {Structure} structure
	 */
	startStructureDrag(e, structure) {
		const dragData = {
			type: 'existing_structure',
			uuid: structure.uuid,
			slot_start: structure.slot_start,
			slot_end: structure.slot_end,
			occupied_slots: structure.slot_end - structure.slot_start + 1
		};
		e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a cable
	 * @param {DragEvent} e - Drag event
	 * @param {Cable} cable
	 * @param {Fiber[]|null} fibers - Optional pre-loaded fibers array
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
		e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a bundle
	 * @param {DragEvent} e - Drag event
	 * @param {Cable} cable
	 * @param {Bundle} bundle
	 */
	startBundleDrag(e, cable, bundle) {
		e.stopPropagation();
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
		e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a fiber
	 * @param {DragEvent} e - Drag event
	 * @param {Cable} cable
	 * @param {Bundle} bundle
	 * @param {Fiber} fiber
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
		e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging an address (with all its residential units for bulk drop)
	 * @param {DragEvent} e - Drag event
	 * @param {Address} address
	 * @param {ResidentialUnit[]} residentialUnits
	 */
	startAddressDrag(e, address, residentialUnits) {
		const dragData = {
			type: 'address',
			uuid: address.uuid,
			display: this.#getAddressDisplay(address),
			unit_count: residentialUnits.length,
			residential_units: residentialUnits.map((ru) => ({
				uuid: ru.uuid,
				id_residential_unit: ru.id_residential_unit,
				external_id_1: ru.external_id_1,
				external_id_2: ru.external_id_2,
				floor: ru.floor,
				side: ru.side,
				resident_name: ru.resident_name
			}))
		};
		e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Start dragging a single residential unit
	 * @param {DragEvent} e - Drag event
	 * @param {Address} address
	 * @param {ResidentialUnit} residentialUnit
	 */
	startResidentialUnitDrag(e, address, residentialUnit) {
		e.stopPropagation();
		const dragData = {
			type: 'residential_unit',
			uuid: residentialUnit.uuid,
			address_uuid: address.uuid,
			address_display: this.#getAddressDisplay(address),
			id_residential_unit: residentialUnit.id_residential_unit,
			display_name: this.#getResidentialUnitDisplayName(residentialUnit),
			resident_name: residentialUnit.resident_name
		};
		e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
		this.startDrag(dragData);
	}

	/**
	 * Get address display string (private helper)
	 * @param {Address} address
	 * @returns {string}
	 */
	#getAddressDisplay(address) {
		let display = address.street + ' ' + address.housenumber;
		if (address.house_number_suffix) {
			display += address.house_number_suffix;
		}
		return display;
	}

	/**
	 * Get residential unit display name (private helper)
	 * @param {ResidentialUnit} ru
	 * @returns {string}
	 */
	#getResidentialUnitDisplayName(ru) {
		let main = ru.id_residential_unit || 'Unit';
		if (ru.external_id_1) {
			main += ` (${ru.external_id_1})`;
		} else if (ru.external_id_2) {
			main += ` (${ru.external_id_2})`;
		} else if (ru.floor || ru.side) {
			const parts = [];
			if (ru.floor) parts.push(`${ru.floor}. OG`);
			if (ru.side) parts.push(ru.side);
			if (parts.length) main += ` (${parts.join(' ')})`;
		}
		return main;
	}

	/**
	 * Update drop preview for slot grid
	 * @param {number} slotNumber - Target slot number
	 * @param {number} totalSlots - Total slots in config
	 * @param {Map<number, string>} occupiedSlots - Map of occupied slots
	 * @returns {{ preview: number[], canDrop: boolean, componentRanges: SlotRange[] }}
	 */
	updateDropPreview(slotNumber, totalSlots, occupiedSlots) {
		const isMulti = this.draggedItem?.type === 'multi_component_type';
		const singleOccupied = this.draggedItem?.occupied_slots || 1;
		const count = isMulti ? this.draggedItem?.count || 1 : 1;
		const occupiedSlotsCount = isMulti
			? this.draggedItem?.total_slots || singleOccupied
			: singleOccupied;
		const previewEnd = Math.min(slotNumber + occupiedSlotsCount - 1, totalSlots);
		/** @type {number[]} */
		const preview = [];
		/** @type {SlotRange[]} */
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
	 * @returns {DragItem|null}
	 */
	parseDropData(e) {
		const jsonData = e.dataTransfer?.getData('application/json');
		if (!jsonData) return null;
		try {
			return JSON.parse(jsonData);
		} catch {
			return null;
		}
	}

	/**
	 * Select an item for mobile (tap-to-place mode)
	 * @param {DragItem} item
	 */
	selectMobileItem(item) {
		this.mobileSelectedItem = item;
	}

	/**
	 * Select a component for mobile placement
	 * @param {ComponentType} componentType
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
	 * @param {Cable} cable
	 * @param {Bundle} bundle
	 * @param {Fiber} fiber
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
	 * Select a residential unit for mobile placement
	 * @param {Address} address
	 * @param {ResidentialUnit} residentialUnit
	 */
	selectMobileResidentialUnit(address, residentialUnit) {
		this.mobileSelectedItem = {
			type: 'residential_unit',
			uuid: residentialUnit.uuid,
			address_uuid: address.uuid,
			address_display: this.#getAddressDisplay(address),
			id_residential_unit: residentialUnit.id_residential_unit,
			display_name: this.#getResidentialUnitDisplayName(residentialUnit),
			resident_name: residentialUnit.resident_name,
			name: this.#getResidentialUnitDisplayName(residentialUnit)
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
