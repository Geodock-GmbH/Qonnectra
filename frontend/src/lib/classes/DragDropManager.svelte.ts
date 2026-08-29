import type { Fiber } from './CableFiberDataManager.svelte';

import { m } from '$lib/paraglide/messages';

interface ComponentType {
	id: number;
	component_type: string;
	occupied_slots: number;
}

interface Structure {
	uuid: string;
	slot_start: number;
	slot_end: number;
}

interface Cable {
	uuid: string;
	name?: string;
	fiber_count?: number;
	direction?: string;
}

interface Bundle {
	bundleNumber: number;
	bundleColor: string;
	fibers: Fiber[];
}

interface Address {
	uuid: string;
	street: string;
	housenumber: string | number;
	house_number_suffix?: string;
}

interface ResidentialUnit {
	uuid: string;
	id_residential_unit?: string;
	external_id_1?: string;
	external_id_2?: string;
	floor?: string;
	side?: string;
	resident_name?: string;
}

interface DragItem {
	type: string;
	id?: number;
	uuid?: string;
	name?: string;
	occupied_slots?: number;
	count?: number;
	total_slots?: number;
	slot_start?: number;
	slot_end?: number;
	cable_uuid?: string;
	cable_name?: string;
	bundle_number?: number;
	fiber_number?: number;
	fiber_color?: string;
	fiber_count?: number;
	direction?: string;
	fibers?: Fiber[] | null;
	address_uuid?: string;
	address_display?: string;
	id_residential_unit?: string;
	display_name?: string;
	resident_name?: string;
	bundle_color?: string;
	unit_count?: number;
	residential_units?: DragResidentialUnit[];
	display?: string;
}

interface DragResidentialUnit {
	uuid: string;
	id_residential_unit?: string;
	external_id_1?: string;
	external_id_2?: string;
	floor?: string;
	side?: string;
	resident_name?: string;
}

interface SlotRange {
	start: number;
	end: number;
}

/**
 * Manager for drag-and-drop state across components.
 * Shared via context for coordinated drag-drop between sidebars and grid.
 */
export class DragDropManager {
	isDragging: boolean = $state(false);

	draggedItem: DragItem | null = $state(null);

	dropPreviewSlots: number[] = $state([]);

	mobileSelectedItem: DragItem | null = $state(null);

	componentRanges: SlotRange[] = $state([]);

	/**
	 * Begins a drag operation and sets the dragged item.
	 * @param item - The item being dragged
	 */
	startDrag(item: DragItem): void {
		this.isDragging = true;
		this.draggedItem = item;
	}

	/**
	 * Ends the current drag operation and resets all drag state.
	 */
	endDrag(): void {
		this.isDragging = false;
		this.draggedItem = null;
		this.dropPreviewSlots = [];
		this.componentRanges = [];
	}

	/**
	 * Initiates a drag for a single component type from the sidebar.
	 * @param componentType
	 */
	startComponentDrag(componentType: ComponentType): void {
		this.startDrag({
			type: 'component_type',
			id: componentType.id,
			name: componentType.component_type,
			occupied_slots: componentType.occupied_slots
		});
	}

	/**
	 * Initiates a drag for placing multiple components of the same type.
	 * @param componentType
	 * @param count - Number of components to place
	 */
	startMultiComponentDrag(componentType: ComponentType, count: number): void {
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
	 * Initiates a drag for an existing structure already placed in the slot grid.
	 * @param e - The native drag event
	 * @param structure
	 */
	startStructureDrag(e: DragEvent, structure: Structure): void {
		const dragData: DragItem = {
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
	 * Initiates a drag for a cable, optionally including pre-loaded fiber data.
	 * @param e - The native drag event
	 * @param cable
	 * @param fibers - Pre-loaded fibers, or null to defer loading
	 */
	startCableDrag(e: DragEvent, cable: Cable, fibers: Fiber[] | null = null): void {
		const dragData: DragItem = {
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
	 * Initiates a drag for a fiber bundle within a cable.
	 * @param e - The native drag event
	 * @param cable
	 * @param bundle
	 */
	startBundleDrag(e: DragEvent, cable: Cable, bundle: Bundle): void {
		e.stopPropagation();
		const fibers: Fiber[] = bundle.fibers.map((f) => ({
			uuid: f.uuid,
			fiber_number_absolute: f.fiber_number_absolute,
			fiber_number_in_bundle: f.fiber_number_in_bundle,
			fiber_color: f.fiber_color,
			bundle_number: f.bundle_number,
			bundle_color: f.bundle_color
		}));
		const dragData: DragItem = {
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
	 * Initiates a drag for a single fiber within a bundle.
	 * @param e - The native drag event
	 * @param cable
	 * @param bundle
	 * @param fiber
	 */
	startFiberDrag(e: DragEvent, cable: Cable, bundle: Bundle, fiber: Fiber): void {
		e.stopPropagation();
		const dragData: DragItem = {
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
	 * Initiates a drag for an address including all its residential units for bulk placement.
	 * @param e - The native drag event
	 * @param address
	 * @param residentialUnits
	 */
	startAddressDrag(e: DragEvent, address: Address, residentialUnits: ResidentialUnit[]): void {
		const dragData: DragItem = {
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
	 * Initiates a drag for a single residential unit.
	 * @param e - The native drag event
	 * @param address
	 * @param residentialUnit
	 */
	startResidentialUnitDrag(e: DragEvent, address: Address, residentialUnit: ResidentialUnit): void {
		e.stopPropagation();
		const dragData: DragItem = {
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
	 * Formats an address into a human-readable display string (street + housenumber + suffix).
	 * @param address
	 */
	#getAddressDisplay(address: Address): string {
		let display = address.street + ' ' + address.housenumber;
		if (address.house_number_suffix) {
			display += address.house_number_suffix;
		}
		return display;
	}

	/**
	 * Builds a display name for a residential unit using available identifiers,
	 * falling back to external IDs, floor, or side info.
	 * @param ru
	 */
	#getResidentialUnitDisplayName(ru: ResidentialUnit): string {
		let main = ru.id_residential_unit || 'Unit';
		if (ru.external_id_1) {
			main += ` (${ru.external_id_1})`;
		} else if (ru.external_id_2) {
			main += ` (${ru.external_id_2})`;
		} else if (ru.floor != null || ru.side) {
			const parts: string[] = [];
			if (ru.floor != null) {
				const f = Number(ru.floor);
				if (f === 0) parts.push('EG');
				else if (f < 0) parts.push(`${Math.abs(f)}. UG`);
				else parts.push(`${f}. OG`);
			}
			if (ru.side) parts.push(ru.side);
			if (parts.length) main += ` (${parts.join(' ')})`;
		}
		return main;
	}

	/**
	 * Update drop preview for slot grid
	 * @param slotNumber - Target slot number
	 * @param totalSlots - Total slots in config
	 * @param occupiedSlots - Map of occupied slots
	 */
	updateDropPreview(
		slotNumber: number,
		totalSlots: number,
		occupiedSlots: Map<number, string>
	): { preview: number[]; canDrop: boolean; componentRanges: SlotRange[] } {
		const isMulti = this.draggedItem?.type === 'multi_component_type';
		const singleOccupied = this.draggedItem?.occupied_slots || 1;
		const count = isMulti ? this.draggedItem?.count || 1 : 1;
		const occupiedSlotsCount = isMulti
			? this.draggedItem?.total_slots || singleOccupied
			: singleOccupied;
		const previewEnd = Math.min(slotNumber + occupiedSlotsCount - 1, totalSlots);
		const preview: number[] = [];
		const componentRanges: SlotRange[] = [];
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
	 * Resets the drop preview slots and component ranges.
	 */
	clearDropPreview(): void {
		this.dropPreviewSlots = [];
		this.componentRanges = [];
	}

	/**
	 * Validates whether a drop is allowed at a given slot.
	 * Allows drops on unoccupied slots or slots occupied by the item being moved.
	 * @param slotNumber
	 * @param occupiedSlots - Map of slot number to occupying structure UUID
	 */
	validateDropTarget(slotNumber: number, occupiedSlots: Map<number, string>): boolean {
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
	 * Determines the drop effect based on the drag type and drop validity.
	 * Existing structures use 'move'; new items use 'copy'.
	 * @param canDrop - Whether the current drop target is valid
	 */
	getDropEffect(canDrop: boolean): 'copy' | 'move' | 'none' {
		if (!canDrop) return 'none';
		return this.draggedItem?.type === 'existing_structure' ? 'move' : 'copy';
	}

	/**
	 * Extracts and parses the drag item payload from a drop event's dataTransfer.
	 * @param e
	 */
	parseDropData(e: DragEvent): DragItem | null {
		const jsonData = e.dataTransfer?.getData('application/json');
		if (!jsonData) return null;
		try {
			return JSON.parse(jsonData);
		} catch {
			return null;
		}
	}

	/**
	 * Selects an item for mobile tap-to-place mode.
	 * @param item
	 */
	selectMobileItem(item: DragItem): void {
		this.mobileSelectedItem = item;
	}

	/**
	 * Selects a component type for mobile tap-to-place mode, supporting single or multi placement.
	 * @param componentType
	 * @param count - Number of components to place (default 1)
	 */
	selectMobileComponent(componentType: ComponentType, count: number = 1): void {
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
	 * Selects a fiber for mobile tap-to-place mode.
	 * @param cable
	 * @param bundle
	 * @param fiber
	 */
	selectMobileFiber(cable: Cable, bundle: Bundle, fiber: Fiber): void {
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
	 * Selects a residential unit for mobile tap-to-place mode.
	 * @param address
	 * @param residentialUnit
	 */
	selectMobileResidentialUnit(address: Address, residentialUnit: ResidentialUnit): void {
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
	 * Clears the current mobile tap-to-place selection.
	 */
	clearMobileSelection(): void {
		this.mobileSelectedItem = null;
	}

	/**
	 * Clears mobile selection when the viewport switches to desktop mode.
	 * @param isMobile - Whether the current viewport is mobile
	 */
	handleResponsiveChange(isMobile: boolean): void {
		if (!isMobile) {
			this.mobileSelectedItem = null;
		}
	}

	/**
	 * Resets all manager state to initial values.
	 */
	cleanup(): void {
		this.isDragging = false;
		this.draggedItem = null;
		this.dropPreviewSlots = [];
		this.componentRanges = [];
		this.mobileSelectedItem = null;
	}
}

/** Context key for DragDropManager */
export const DRAG_DROP_CONTEXT_KEY = 'dragDropManager';
