import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { NodeStructureContext } from './NodeStructureContext.svelte';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_error: () => 'Fehler',
		message_error_placing_component: () => 'Komponente konnte nicht platziert werden'
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

const {
	structureManagerInstances,
	spliceManagerInstances,
	FakeStructureManager,
	FakeSpliceManager
} = vi.hoisted(() => {
	const structureManagerInstances: InstanceType<typeof FakeStructureManager>[] = [];
	const spliceManagerInstances: InstanceType<typeof FakeSpliceManager>[] = [];

	class FakeStructureManager {
		nodeUuid: string | null;
		slotConfigurations = [];
		selectedSlotConfigUuid: string | null = null;
		selectedConfig = { uuid: 'cfg-1', total_slots: 24 };
		containerPath = '';
		structures: unknown[] = [{ uuid: 's1' }];
		occupiedSlots = new Map<number, string>();
		loading = false;
		loadingStructures = false;
		creatingMultiple = false;
		selectSlotConfig = vi.fn();
		computeSlotRows = vi.fn(() => [
			{ slotNumber: 1, isOccupied: false },
			{ slotNumber: 2, isOccupied: false }
		]);
		fetchSlotConfigurations = vi.fn(() => Promise.resolve());
		fetchAllForSlotConfig = vi.fn(() => Promise.resolve());
		setNodeUuid = vi.fn();
		syncWithSharedState = vi.fn();
		toggleDivider = vi.fn();
		createStructure = vi.fn(() => Promise.resolve());
		createMultipleStructures = vi.fn(() => Promise.resolve());
		moveStructure = vi.fn(() => Promise.resolve());
		deleteStructure = vi.fn(() => Promise.resolve(true));
		saveClipNumber = vi.fn(() => Promise.resolve());
		cleanup = vi.fn();

		constructor(nodeUuid: string | null) {
			this.nodeUuid = nodeUuid;
			structureManagerInstances.push(this);
		}
	}

	class FakeSpliceManager {
		selectedStructure = null;
		portRowsWithMerge = [];
		fiberColors = [];
		loadingPorts = false;
		mergeSelectionMode = false;
		selectedForMerge = [];
		mergeSide = 'a';
		selectStructure = vi.fn(() => Promise.resolve(true));
		closePortTable = vi.fn();
		handleClearPort = vi.fn();
		toggleMergeSelectionMode = vi.fn();
		togglePortSelection = vi.fn();
		mergeSelectedPorts = vi.fn();
		unmergePorts = vi.fn();
		handleMergedPortDrop = vi.fn();
		setMergeSide = vi.fn();
		handlePortDrop = vi.fn(() => Promise.resolve(true));
		onStructureDeleted = vi.fn();
		cleanup = vi.fn();

		constructor() {
			spliceManagerInstances.push(this);
		}
	}

	return {
		structureManagerInstances,
		spliceManagerInstances,
		FakeStructureManager,
		FakeSpliceManager
	};
});

vi.mock('./NodeStructureManager.svelte', () => ({
	NodeStructureManager: FakeStructureManager
}));

vi.mock('./FiberSpliceManager.svelte', () => ({
	FiberSpliceManager: FakeSpliceManager
}));

const fetchMock = vi.fn();

function makeDragEvent(payload: unknown = null): DragEvent {
	return {
		preventDefault: vi.fn(),
		dataTransfer: {
			dropEffect: '',
			getData: () => (payload === null ? '' : JSON.stringify(payload)),
			setData: vi.fn()
		}
	} as unknown as DragEvent;
}

function newContext(): {
	context: NodeStructureContext;
	structureManager: FakeStructureManager;
	spliceManager: FakeSpliceManager;
} {
	const context = new NodeStructureContext('node-1');
	return {
		context,
		structureManager: structureManagerInstances[structureManagerInstances.length - 1],
		spliceManager: spliceManagerInstances[spliceManagerInstances.length - 1]
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	structureManagerInstances.length = 0;
	spliceManagerInstances.length = 0;
	vi.mocked(globalToaster.error).mockClear();
});

describe('delegation', () => {
	test('should expose structure manager state through getters', () => {
		const { context } = newContext();

		expect(context.nodeUuid).toBe('node-1');
		expect(context.selectedConfig).toEqual({ uuid: 'cfg-1', total_slots: 24 });
		expect(context.structures).toEqual([{ uuid: 's1' }]);
	});

	test('should mark drop preview slots in computed slot rows', () => {
		const { context } = newContext();

		context.dropPreviewSlots = [2];

		expect(context.computeSlotRows()).toEqual([
			{ slotNumber: 1, isOccupied: false, isDropTarget: false },
			{ slotNumber: 2, isOccupied: false, isDropTarget: true }
		]);
	});

	test('should initialize by fetching slot configurations', async () => {
		const { context, structureManager } = newContext();

		await context.initialize();

		expect(structureManager.fetchSlotConfigurations).toHaveBeenCalled();
	});
});

describe('slot drop handling', () => {
	test('should create a structure when dropping a component type', async () => {
		const { context, structureManager } = newContext();
		const payload = { type: 'component_type', id: 1, name: 'Kassette', occupied_slots: 4 };

		await context.slotActions.onDrop(makeDragEvent(payload), 5);

		expect(structureManager.createStructure).toHaveBeenCalledWith(payload, 5);
	});

	test('should create multiple structures for multi-component drops', async () => {
		const { context, structureManager } = newContext();
		const payload = { type: 'multi_component_type', id: 1, occupied_slots: 2, count: 3 };

		await context.slotActions.onDrop(makeDragEvent(payload), 1);

		expect(structureManager.createMultipleStructures).toHaveBeenCalledWith(payload, 1);
	});

	test('should move an existing structure to the new slot', async () => {
		const { context, structureManager } = newContext();
		const payload = { type: 'existing_structure', uuid: 's1', slot_start: 3, occupied_slots: 2 };

		await context.slotActions.onDrop(makeDragEvent(payload), 7);

		expect(structureManager.moveStructure).toHaveBeenCalledWith(payload, 7);
	});

	test('should ignore drops of a structure onto its own start slot', async () => {
		const { context, structureManager } = newContext();
		const payload = { type: 'existing_structure', uuid: 's1', slot_start: 3, occupied_slots: 2 };

		await context.slotActions.onDrop(makeDragEvent(payload), 3);

		expect(structureManager.moveStructure).not.toHaveBeenCalled();
	});

	test('should ignore drops without payload data', async () => {
		const { context, structureManager } = newContext();

		await context.slotActions.onDrop(makeDragEvent(null), 3);

		expect(structureManager.createStructure).not.toHaveBeenCalled();
	});

	test('should toast an error when placement fails', async () => {
		const { context, structureManager } = newContext();
		structureManager.createStructure.mockRejectedValue(new Error('Slot belegt'));

		await context.slotActions.onDrop(
			makeDragEvent({ type: 'component_type', id: 1, occupied_slots: 1 }),
			2
		);

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Slot belegt' })
		);
	});
});

describe('mobile tap-to-place', () => {
	test('should place the selected mobile component on tap', async () => {
		const { context, structureManager } = newContext();
		context.getDragDropManager().selectMobileComponent({
			id: 1,
			component_type: 'Kassette',
			occupied_slots: 4
		});

		await context.slotActions.onTap(6);

		expect(structureManager.createStructure).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'component_type', id: 1 }),
			6
		);
		expect(context.mobileSelectedItem).toBeNull();
	});

	test('should place multiple components for a multi selection', async () => {
		const { context, structureManager } = newContext();
		context
			.getDragDropManager()
			.selectMobileComponent({ id: 1, component_type: 'Kassette', occupied_slots: 2 }, 3);

		await context.slotActions.onTap(1);

		expect(structureManager.createMultipleStructures).toHaveBeenCalled();
	});

	test('should do nothing on tap without a mobile selection', async () => {
		const { context, structureManager } = newContext();

		await context.slotActions.onTap(6);

		expect(structureManager.createStructure).not.toHaveBeenCalled();
	});
});

describe('structure deletion', () => {
	test('should delete directly when the structure has no active splices', async () => {
		fetchMock.mockResolvedValue({
			text: () => Promise.resolve(JSON.stringify({ type: 'success', data: { splices: [] } }))
		});
		const { context, structureManager, spliceManager } = newContext();

		const result = await context.structureActions.onDelete('s1');

		expect(result).toEqual({ needsConfirmation: false, spliceCount: 0 });
		expect(structureManager.deleteStructure).toHaveBeenCalledWith('s1');
		expect(spliceManager.onStructureDeleted).toHaveBeenCalledWith('s1');
	});

	test('should require confirmation when active splices exist', async () => {
		fetchMock.mockResolvedValue({
			text: () =>
				Promise.resolve(
					JSON.stringify({
						type: 'success',
						data: {
							splices: [
								{ port_number: 1, fiber_a_details: { uuid: 'f1' } },
								{ port_number: 2, fiber_a_details: null, fiber_b_details: null }
							]
						}
					})
				)
		});
		const { context, structureManager } = newContext();

		const result = await context.structureActions.onDelete('s1');

		expect(result).toEqual({ needsConfirmation: true, spliceCount: 1, structureUuid: 's1' });
		expect(structureManager.deleteStructure).not.toHaveBeenCalled();
	});

	test('should fall back to deleting when the splice check fails', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const { context, structureManager } = newContext();

		const result = await context.structureActions.onDelete('s1');

		expect(result).toEqual({ needsConfirmation: false, spliceCount: 0 });
		expect(structureManager.deleteStructure).toHaveBeenCalledWith('s1');
	});

	test('should dispatch a fiberSpliceChanged event after deletion', async () => {
		const eventSpy = vi.fn();
		window.addEventListener('fiberSpliceChanged', eventSpy);
		const { context } = newContext();

		await context.executeDelete('s1');

		expect(eventSpy).toHaveBeenCalled();
		window.removeEventListener('fiberSpliceChanged', eventSpy);
	});
});

describe('clip number editing', () => {
	test('should start editing with the current value or the slot number', () => {
		const { context } = newContext();

		context.clipActions.onStartEditing(4, 'K-4');
		expect(context.editingClipSlot).toBe(4);
		expect(context.editingClipValue).toBe('K-4');

		context.clipActions.onStartEditing(9, null);
		expect(context.editingClipValue).toBe('9');
	});

	test('should save the clip number and reset the edit state', async () => {
		const { context, structureManager } = newContext();
		context.clipActions.onStartEditing(4, 'K-4');

		await context.clipActions.onSave();

		expect(structureManager.saveClipNumber).toHaveBeenCalledWith(4, 'K-4');
		expect(context.editingClipSlot).toBeNull();
	});

	test('should not save empty clip values', async () => {
		const { context, structureManager } = newContext();
		context.clipActions.onStartEditing(4, '  ');

		await context.clipActions.onSave();

		expect(structureManager.saveClipNumber).not.toHaveBeenCalled();
	});

	test('should save on Enter and cancel on Escape', () => {
		const { context, structureManager } = newContext();
		context.clipActions.onStartEditing(4, 'K-4');

		context.clipActions.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(context.editingClipSlot).toBeNull();

		context.clipActions.onStartEditing(5, 'K-5');
		context.clipActions.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(structureManager.saveClipNumber).toHaveBeenCalledWith(5, 'K-5');
	});
});

describe('port drops', () => {
	test('should pass structures along for cable drops', async () => {
		const { context, spliceManager } = newContext();

		await context.portActions.onDrop(3, 'a', { type: 'cable' });

		expect(spliceManager.handlePortDrop).toHaveBeenCalledWith(3, 'a', { type: 'cable' }, [
			{ uuid: 's1' }
		]);
	});

	test('should pass no structures for fiber drops', async () => {
		const { context, spliceManager } = newContext();

		await context.portActions.onDrop(3, 'b', { type: 'fiber' });

		expect(spliceManager.handlePortDrop).toHaveBeenCalledWith(3, 'b', { type: 'fiber' }, []);
	});
});

describe('lifecycle', () => {
	test('should reset all managers when switching nodes', () => {
		const { context, structureManager, spliceManager } = newContext();
		context.clipActions.onStartEditing(4, 'K-4');

		context.setNodeUuid('node-2');

		expect(structureManager.setNodeUuid).toHaveBeenCalledWith('node-2', null);
		expect(spliceManager.closePortTable).toHaveBeenCalled();
		expect(context.editingClipSlot).toBeNull();
	});

	test('should propagate responsive changes to the drag drop manager', () => {
		const { context } = newContext();
		context.getDragDropManager().selectMobileItem({ type: 'component_type' });

		context.handleResponsiveChange(false);

		expect(context.isMobile).toBe(false);
		expect(context.mobileSelectedItem).toBeNull();
	});

	test('should clean up all managers', () => {
		const { context, structureManager, spliceManager } = newContext();
		context.clipActions.onStartEditing(4, 'K-4');

		context.cleanup();

		expect(structureManager.cleanup).toHaveBeenCalled();
		expect(spliceManager.cleanup).toHaveBeenCalled();
		expect(context.editingClipSlot).toBeNull();
	});
});
