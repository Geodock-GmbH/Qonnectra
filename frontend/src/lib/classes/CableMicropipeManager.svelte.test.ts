import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { CableMicropipeManager } from './CableMicropipeManager.svelte';

// Micropipe wiring runs through the remote module; mock it so the class's calls
// are observable without a running server.
const getLinkedTrenchesForCable = vi.fn();
const getConduitsByTrenches = vi.fn();
const getMicropipesByConduits = vi.fn();
const createMicropipeConnections = vi.fn();
const deleteMicropipeConnections = vi.fn();

vi.mock('$lib/remote/network-schema/micropipes.remote', () => ({
	getLinkedTrenchesForCable: (...a: unknown[]) => getLinkedTrenchesForCable(...a),
	getConduitsByTrenches: (...a: unknown[]) => getConduitsByTrenches(...a),
	getMicropipesByConduits: (...a: unknown[]) => getMicropipesByConduits(...a),
	createMicropipeConnections: (...a: unknown[]) => createMicropipeConnections(...a),
	deleteMicropipeConnections: (...a: unknown[]) => deleteMicropipeConnections(...a)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_error: () => 'Fehler',
		title_success: () => 'Erfolg',
		message_created_connections: () => 'Verbindungen erstellt',
		message_connection_deleted_successfully: () => 'Verbindung gelöscht'
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	getLinkedTrenchesForCable.mockResolvedValue([]);
	getConduitsByTrenches.mockResolvedValue([]);
	getMicropipesByConduits.mockResolvedValue([]);
	createMicropipeConnections.mockResolvedValue(undefined);
	deleteMicropipeConnections.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	[
		getLinkedTrenchesForCable,
		getConduitsByTrenches,
		getMicropipesByConduits,
		createMicropipeConnections,
		deleteMicropipeConnections
	].forEach((fn) => fn.mockReset());
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('initialize', () => {
	test('should reset state and load linked trenches for the cable', async () => {
		getLinkedTrenchesForCable.mockResolvedValue(['t1', 't2']);
		const manager = new CableMicropipeManager();
		manager.step = 2;

		manager.initialize('cable-1', 'K-Nord');
		await vi.waitFor(() => expect(manager.linkedTrenchIds.size).toBe(2));

		expect(manager.cableId).toBe('cable-1');
		expect(manager.cableName).toBe('K-Nord');
		expect(manager.step).toBe(1);
		expect(manager.linkedTrenchIds.has('t1')).toBe(true);
		expect(getLinkedTrenchesForCable).toHaveBeenCalledWith('cable-1');
	});

	test('should clear linked trenches when the fetch fails', async () => {
		getLinkedTrenchesForCable.mockRejectedValue(new Error('nope'));
		const manager = new CableMicropipeManager();

		manager.initialize('cable-1', 'K-Nord');
		await vi.waitFor(() => expect(getLinkedTrenchesForCable).toHaveBeenCalled());

		expect(manager.linkedTrenchIds.size).toBe(0);
	});
});

describe('handleTrenchSelection', () => {
	test('should store the selection and fetch conduits for it', async () => {
		getConduitsByTrenches.mockResolvedValue([
			{ uuid: 'c1', name: 'DA 50', conduit_type_name: 'Rohr', has_cable_linkage: false }
		]);
		const manager = new CableMicropipeManager();
		manager.cableId = 'cable-1';

		await manager.handleTrenchSelection(['t1', 't2']);

		expect(manager.selectedTrenchIds.size).toBe(2);
		expect(manager.conduits).toHaveLength(1);
		expect(getConduitsByTrenches).toHaveBeenCalledWith({
			trenchIds: ['t1', 't2'],
			cableId: 'cable-1'
		});
	});

	test('should clear conduits when no trenches are selected', async () => {
		const manager = new CableMicropipeManager();

		await manager.handleTrenchSelection([]);

		expect(manager.conduits).toEqual([]);
		expect(getConduitsByTrenches).not.toHaveBeenCalled();
	});

	test('should toast an error when the conduit fetch fails', async () => {
		getConduitsByTrenches.mockRejectedValue(new Error('Keine Rohre'));
		const manager = new CableMicropipeManager();

		await manager.handleTrenchSelection(['t1']);

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Keine Rohre' })
		);
		expect(manager.loading).toBe(false);
	});
});

describe('conduit selection', () => {
	test('should toggle conduits in and out of the selection', () => {
		const manager = new CableMicropipeManager();

		manager.toggleConduit('c1');
		expect(manager.selectedConduitIds.has('c1')).toBe(true);

		manager.toggleConduit('c1');
		expect(manager.selectedConduitIds.has('c1')).toBe(false);
	});

	test('should clear the conduit selection', () => {
		const manager = new CableMicropipeManager();
		manager.toggleConduit('c1');

		manager.clearConduitSelection();

		expect(manager.selectedConduitIds.size).toBe(0);
	});
});

describe('step navigation', () => {
	test('should fetch micropipes and advance to step 2', async () => {
		getMicropipesByConduits.mockResolvedValue([
			{ number: 1, color_name: 'rot', available_in_all: true }
		]);
		const manager = new CableMicropipeManager();
		manager.cableId = 'cable-1';
		manager.toggleConduit('c1');

		await manager.goToStep2();

		expect(manager.step).toBe(2);
		expect(manager.micropipes).toHaveLength(1);
		expect(getMicropipesByConduits).toHaveBeenCalledWith({
			conduitIds: ['c1'],
			cableId: 'cable-1'
		});
	});

	test('should stay on step 1 without selected conduits', async () => {
		const manager = new CableMicropipeManager();

		await manager.goToStep2();

		expect(manager.step).toBe(1);
		expect(getMicropipesByConduits).not.toHaveBeenCalled();
	});

	test('should return to step 1 and clear the micropipe selection', () => {
		const manager = new CableMicropipeManager();
		manager.step = 2;
		manager.selectedMicropipe = { number: 1, color_name: 'rot' };

		manager.goToStep1();

		expect(manager.step).toBe(1);
		expect(manager.selectedMicropipe).toBeNull();
	});
});

describe('selectMicropipe', () => {
	test('should only select micropipes available in all conduits', () => {
		const manager = new CableMicropipeManager();

		manager.selectMicropipe({ number: 1, color_name: 'rot', available_in_all: false });
		expect(manager.selectedMicropipe).toBeNull();

		manager.selectMicropipe({ number: 1, color_name: 'rot', available_in_all: true });
		expect(manager.selectedMicropipe).toEqual({ number: 1, color_name: 'rot' });
	});

	test('should deselect when selecting the same micropipe again', () => {
		const manager = new CableMicropipeManager();

		manager.selectMicropipe({ number: 1, color_name: 'rot', available_in_all: true });
		manager.selectMicropipe({ number: 1, color_name: 'rot', available_in_all: true });

		expect(manager.selectedMicropipe).toBeNull();
	});
});

describe('saveLinkage', () => {
	test('should post the linkage, toast success, refresh, and return to step 1', async () => {
		const manager = new CableMicropipeManager();
		manager.cableId = 'cable-1';
		manager.toggleConduit('c1');
		manager.selectedMicropipe = { number: 3, color_name: 'blau' };
		manager.step = 2;

		await manager.saveLinkage();

		expect(createMicropipeConnections).toHaveBeenCalledWith({
			cableId: 'cable-1',
			micropipeNumber: 3,
			color: 'blau',
			conduitIds: ['c1']
		});
		expect(globalToaster.success).toHaveBeenCalled();
		expect(manager.step).toBe(1);
		expect(manager.saving).toBe(false);
	});

	test('should do nothing without a selected micropipe', async () => {
		const manager = new CableMicropipeManager();
		manager.toggleConduit('c1');

		await manager.saveLinkage();

		expect(createMicropipeConnections).not.toHaveBeenCalled();
	});

	test('should toast the backend error and stay on step 2', async () => {
		createMicropipeConnections.mockRejectedValue(new Error('Belegt'));
		const manager = new CableMicropipeManager();
		manager.cableId = 'cable-1';
		manager.toggleConduit('c1');
		manager.selectedMicropipe = { number: 3, color_name: 'blau' };
		manager.step = 2;

		await manager.saveLinkage();

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Belegt' })
		);
		expect(manager.step).toBe(2);
	});
});

describe('removeLinkage', () => {
	test('should delete the connections and refresh state', async () => {
		const manager = new CableMicropipeManager();
		manager.cableId = 'cable-1';

		await manager.removeLinkage(4, ['c1', 'c2']);

		expect(deleteMicropipeConnections).toHaveBeenCalledWith({
			cableId: 'cable-1',
			micropipeNumber: 4,
			conduitIds: ['c1', 'c2']
		});
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should toast the backend error on failure', async () => {
		deleteMicropipeConnections.mockRejectedValue(new Error('Nicht gefunden'));
		const manager = new CableMicropipeManager();
		manager.cableId = 'cable-1';

		await manager.removeLinkage(4, ['c1']);

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Nicht gefunden' })
		);
	});
});

describe('clearTrenchSelection', () => {
	test('should clear trenches, conduits, and conduit selection', () => {
		const manager = new CableMicropipeManager();
		manager.selectedTrenchIds.add('t1');
		manager.conduits = [
			{ uuid: 'c1', name: 'DA', conduit_type_name: 'Rohr', has_cable_linkage: false }
		];
		manager.toggleConduit('c1');

		manager.clearTrenchSelection();

		expect(manager.selectedTrenchIds.size).toBe(0);
		expect(manager.conduits).toEqual([]);
		expect(manager.selectedConduitIds.size).toBe(0);
	});
});
