import { describe, expect, test, vi } from 'vitest';

import { DragDropManager } from './DragDropManager.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_fiber: () => 'Faser'
	}
}));

function makeDragEvent(): DragEvent & { store: Record<string, string> } {
	const store: Record<string, string> = {};
	return {
		store,
		stopPropagation: vi.fn(),
		dataTransfer: {
			effectAllowed: '',
			setData: (format: string, data: string) => {
				store[format] = data;
			},
			getData: (format: string) => store[format] || ''
		}
	} as unknown as DragEvent & { store: Record<string, string> };
}

const componentType = { id: 1, component_type: 'Spleißkassette', occupied_slots: 4 };
const cable = { uuid: 'cable-1', name: 'K-Nord', fiber_count: 96, direction: 'A' };
const fiber = {
	uuid: 'fiber-1',
	fiber_number_absolute: 13,
	fiber_number_in_bundle: 1,
	fiber_color: 'rot',
	bundle_number: 2,
	bundle_color: 'blau'
};
const bundle = { bundleNumber: 2, bundleColor: 'blau', fibers: [fiber] };
const address = {
	uuid: 'addr-1',
	street: 'Hauptstraße',
	housenumber: '5',
	house_number_suffix: 'a'
};
const residentialUnit = {
	uuid: 'ru-1',
	id_residential_unit: 'WE-01',
	floor: '2',
	side: 'links',
	resident_name: 'Mieter'
};

describe('basic drag lifecycle', () => {
	test('should track the dragged item and reset on endDrag', () => {
		const manager = new DragDropManager();

		manager.startComponentDrag(componentType);

		expect(manager.isDragging).toBe(true);
		expect(manager.draggedItem).toEqual({
			type: 'component_type',
			id: 1,
			name: 'Spleißkassette',
			occupied_slots: 4
		});

		manager.endDrag();
		expect(manager.isDragging).toBe(false);
		expect(manager.draggedItem).toBeNull();
		expect(manager.dropPreviewSlots).toEqual([]);
	});

	test('should compute total slots for multi-component drags', () => {
		const manager = new DragDropManager();

		manager.startMultiComponentDrag(componentType, 3);

		expect(manager.draggedItem).toMatchObject({
			type: 'multi_component_type',
			count: 3,
			total_slots: 12
		});
	});
});

describe('drag starters with dataTransfer', () => {
	test('startStructureDrag should serialize the structure and use the move effect', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startStructureDrag(event, { uuid: 's1', slot_start: 3, slot_end: 6 });

		expect(JSON.parse(event.store['application/json'])).toEqual({
			type: 'existing_structure',
			uuid: 's1',
			slot_start: 3,
			slot_end: 6,
			occupied_slots: 4
		});
		expect(event.dataTransfer?.effectAllowed).toBe('move');
	});

	test('startCableDrag should include mapped fibers when preloaded', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startCableDrag(event, cable, [fiber]);

		const data = JSON.parse(event.store['application/json']);
		expect(data.type).toBe('cable');
		expect(data.fibers).toEqual([
			{
				uuid: 'fiber-1',
				fiber_number_absolute: 13,
				fiber_number_in_bundle: 1,
				fiber_color: 'rot',
				bundle_number: 2,
				bundle_color: 'blau'
			}
		]);
		expect(event.dataTransfer?.effectAllowed).toBe('copy');
	});

	test('startCableDrag should defer fiber loading when fibers are null', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startCableDrag(event, cable);

		expect(JSON.parse(event.store['application/json']).fibers).toBeNull();
	});

	test('startBundleDrag should serialize all bundle fibers', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startBundleDrag(event, cable, bundle);

		const data = JSON.parse(event.store['application/json']);
		expect(data).toMatchObject({
			type: 'bundle',
			cable_uuid: 'cable-1',
			bundle_number: 2,
			fiber_count: 1
		});
		expect(event.stopPropagation).toHaveBeenCalled();
	});

	test('startFiberDrag should serialize the single fiber', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startFiberDrag(event, cable, bundle, fiber);

		expect(JSON.parse(event.store['application/json'])).toEqual({
			type: 'fiber',
			uuid: 'fiber-1',
			cable_uuid: 'cable-1',
			cable_name: 'K-Nord',
			bundle_number: 2,
			fiber_number: 13,
			fiber_color: 'rot'
		});
	});

	test('startAddressDrag should include the display string and all units', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startAddressDrag(event, address, [residentialUnit]);

		const data = JSON.parse(event.store['application/json']);
		expect(data.display).toBe('Hauptstraße 5a');
		expect(data.unit_count).toBe(1);
		expect(data.residential_units[0].uuid).toBe('ru-1');
	});

	test('startResidentialUnitDrag should build the unit display name', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startResidentialUnitDrag(event, address, residentialUnit);

		const data = JSON.parse(event.store['application/json']);
		expect(data.display_name).toBe('WE-01 (2. OG links)');
		expect(data.address_display).toBe('Hauptstraße 5a');
	});

	test('should format ground floor and basement levels in unit names', () => {
		const manager = new DragDropManager();
		const groundFloorEvent = makeDragEvent();
		manager.startResidentialUnitDrag(groundFloorEvent, address, {
			uuid: 'ru-2',
			id_residential_unit: 'WE-02',
			floor: '0'
		});
		expect(JSON.parse(groundFloorEvent.store['application/json']).display_name).toBe('WE-02 (EG)');

		const basementEvent = makeDragEvent();
		manager.startResidentialUnitDrag(basementEvent, address, {
			uuid: 'ru-3',
			id_residential_unit: 'WE-03',
			floor: '-1'
		});
		expect(JSON.parse(basementEvent.store['application/json']).display_name).toBe('WE-03 (1. UG)');
	});

	test('should prefer external ids over floor info in unit names', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();

		manager.startResidentialUnitDrag(event, address, {
			uuid: 'ru-4',
			id_residential_unit: 'WE-04',
			external_id_1: 'EXT-1',
			floor: '2'
		});

		expect(JSON.parse(event.store['application/json']).display_name).toBe('WE-04 (EXT-1)');
	});
});

describe('updateDropPreview', () => {
	test('should preview the occupied range for a single component', () => {
		const manager = new DragDropManager();
		manager.startComponentDrag(componentType);

		const result = manager.updateDropPreview(3, 24, new Map());

		expect(result.preview).toEqual([3, 4, 5, 6]);
		expect(result.canDrop).toBe(true);
		expect(result.componentRanges).toEqual([{ start: 3, end: 6 }]);
	});

	test('should split ranges per component for multi drags', () => {
		const manager = new DragDropManager();
		manager.startMultiComponentDrag({ ...componentType, occupied_slots: 2 }, 2);

		const result = manager.updateDropPreview(1, 24, new Map());

		expect(result.preview).toEqual([1, 2, 3, 4]);
		expect(result.componentRanges).toEqual([
			{ start: 1, end: 2 },
			{ start: 3, end: 4 }
		]);
	});

	test('should reject drops that overlap occupied slots', () => {
		const manager = new DragDropManager();
		manager.startComponentDrag(componentType);

		const result = manager.updateDropPreview(3, 24, new Map([[5, 'other-structure']]));

		expect(result.canDrop).toBe(false);
		expect(result.componentRanges).toEqual([]);
	});

	test('should allow moving an existing structure over its own slots', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();
		manager.startStructureDrag(event, { uuid: 's1', slot_start: 3, slot_end: 4 });

		const result = manager.updateDropPreview(
			4,
			24,
			new Map([
				[3, 's1'],
				[4, 's1']
			])
		);

		expect(result.canDrop).toBe(true);
	});

	test('should reject drops that run past the end of the grid', () => {
		const manager = new DragDropManager();
		manager.startComponentDrag(componentType);

		const result = manager.updateDropPreview(23, 24, new Map());

		expect(result.canDrop).toBe(false);
	});
});

describe('validateDropTarget', () => {
	test('should allow empty slots and own slots, reject foreign slots', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();
		manager.startStructureDrag(event, { uuid: 's1', slot_start: 1, slot_end: 2 });

		expect(manager.validateDropTarget(5, new Map())).toBe(true);
		expect(manager.validateDropTarget(1, new Map([[1, 's1']]))).toBe(true);
		expect(manager.validateDropTarget(1, new Map([[1, 'other']]))).toBe(false);
	});
});

describe('getDropEffect', () => {
	test('should use move for existing structures and copy otherwise', () => {
		const manager = new DragDropManager();

		manager.startComponentDrag(componentType);
		expect(manager.getDropEffect(true)).toBe('copy');
		expect(manager.getDropEffect(false)).toBe('none');

		const event = makeDragEvent();
		manager.startStructureDrag(event, { uuid: 's1', slot_start: 1, slot_end: 1 });
		expect(manager.getDropEffect(true)).toBe('move');
	});
});

describe('parseDropData', () => {
	test('should parse the payload set by a drag starter', () => {
		const manager = new DragDropManager();
		const event = makeDragEvent();
		manager.startComponentDrag(componentType);
		manager.startStructureDrag(event, { uuid: 's1', slot_start: 1, slot_end: 2 });

		expect(manager.parseDropData(event)).toMatchObject({ type: 'existing_structure' });
	});

	test('should return null for empty or malformed payloads', () => {
		const manager = new DragDropManager();
		const emptyEvent = makeDragEvent();

		expect(manager.parseDropData(emptyEvent)).toBeNull();

		const brokenEvent = makeDragEvent();
		brokenEvent.store['application/json'] = '{broken';
		expect(manager.parseDropData(brokenEvent)).toBeNull();
	});
});

describe('mobile tap-to-place', () => {
	test('should select single and multi components', () => {
		const manager = new DragDropManager();

		manager.selectMobileComponent(componentType);
		expect(manager.mobileSelectedItem).toMatchObject({ type: 'component_type' });

		manager.selectMobileComponent(componentType, 3);
		expect(manager.mobileSelectedItem).toMatchObject({
			type: 'multi_component_type',
			total_slots: 12
		});
	});

	test('should label mobile fibers with the localized fiber name', () => {
		const manager = new DragDropManager();

		manager.selectMobileFiber(cable, bundle, fiber);

		expect(manager.mobileSelectedItem?.name).toBe('K-Nord - Faser 13');
	});

	test('should select residential units with display names', () => {
		const manager = new DragDropManager();

		manager.selectMobileResidentialUnit(address, residentialUnit);

		expect(manager.mobileSelectedItem).toMatchObject({
			type: 'residential_unit',
			display_name: 'WE-01 (2. OG links)'
		});
	});

	test('should clear the mobile selection when leaving mobile mode', () => {
		const manager = new DragDropManager();
		manager.selectMobileItem({ type: 'component_type' });

		manager.handleResponsiveChange(true);
		expect(manager.mobileSelectedItem).not.toBeNull();

		manager.handleResponsiveChange(false);
		expect(manager.mobileSelectedItem).toBeNull();
	});
});

describe('cleanup', () => {
	test('should reset all state', () => {
		const manager = new DragDropManager();
		manager.startComponentDrag(componentType);
		manager.selectMobileItem({ type: 'component_type' });
		manager.updateDropPreview(1, 24, new Map());

		manager.cleanup();

		expect(manager.isDragging).toBe(false);
		expect(manager.draggedItem).toBeNull();
		expect(manager.dropPreviewSlots).toEqual([]);
		expect(manager.componentRanges).toEqual([]);
		expect(manager.mobileSelectedItem).toBeNull();
	});
});
