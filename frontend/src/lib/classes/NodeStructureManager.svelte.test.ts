import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import { NodeStructureManager } from './NodeStructureManager.svelte';

// Reads/writes run through remote-function modules; mock them observably.
const remote = {
	getSlotConfigurationsForNode: vi.fn(),
	getNodeStructures: vi.fn(),
	getSlotDividers: vi.fn(),
	getSlotClipNumbers: vi.fn(),
	createNodeStructure: vi.fn(),
	bulkCreateNodeStructures: vi.fn(),
	moveNodeStructure: vi.fn(),
	deleteNodeStructure: vi.fn(),
	createSlotDivider: vi.fn(),
	deleteSlotDivider: vi.fn(),
	upsertSlotClipNumber: vi.fn()
};

vi.mock('$lib/remote/network-schema/node-structures.remote', () => ({
	getSlotConfigurationsForNode: (...a: unknown[]) =>
		remoteQueryStub(remote.getSlotConfigurationsForNode)(...a),
	getSlotDividers: (...a: unknown[]) => remoteQueryStub(remote.getSlotDividers)(...a),
	getSlotClipNumbers: (...a: unknown[]) => remoteQueryStub(remote.getSlotClipNumbers)(...a),
	createNodeStructure: (...a: unknown[]) => remote.createNodeStructure(...a),
	bulkCreateNodeStructures: (...a: unknown[]) => remote.bulkCreateNodeStructures(...a),
	moveNodeStructure: (...a: unknown[]) => remote.moveNodeStructure(...a),
	deleteNodeStructure: (...a: unknown[]) => remote.deleteNodeStructure(...a),
	createSlotDivider: (...a: unknown[]) => remote.createSlotDivider(...a),
	deleteSlotDivider: (...a: unknown[]) => remote.deleteSlotDivider(...a),
	upsertSlotClipNumber: (...a: unknown[]) => remote.upsertSlotClipNumber(...a)
}));

vi.mock('$lib/remote/network-schema/containers.remote', () => ({
	getNodeStructures: (...a: unknown[]) => remoteQueryStub(remote.getNodeStructures)(...a)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn()
	}
}));

/**
 * Maps the old `{ '?/action': { data } }` shape onto the remote-fn mocks: reads
 * resolve to the bare array (unwrapped from configurations/structures/dividers/
 * clipNumbers); writes resolve to the inner object (structure / {created,failed}
 * / divider). Every fn defaults to an empty-success value.
 */
function mockRoutes(routes: Record<string, { type?: string; data?: Record<string, unknown> }>) {
	const dataFor = (name: string) => routes[`?/${name}`]?.data ?? {};
	remote.getSlotConfigurationsForNode.mockResolvedValue(
		(dataFor('getSlotConfigurationsForNode').configurations as unknown[]) ?? []
	);
	remote.getNodeStructures.mockResolvedValue(
		(dataFor('getNodeStructures').structures as unknown[]) ?? []
	);
	remote.getSlotDividers.mockResolvedValue(
		(dataFor('getSlotDividers').dividers as unknown[]) ?? []
	);
	remote.getSlotClipNumbers.mockResolvedValue(
		(dataFor('getSlotClipNumbers').clipNumbers as unknown[]) ?? []
	);
	remote.createNodeStructure.mockResolvedValue(dataFor('createNodeStructure').structure ?? {});
	remote.bulkCreateNodeStructures.mockResolvedValue({
		created: (dataFor('bulkCreateNodeStructures').created as unknown[]) ?? [],
		failed: (dataFor('bulkCreateNodeStructures').failed as unknown[]) ?? []
	});
	remote.moveNodeStructure.mockResolvedValue(dataFor('moveNodeStructure').structure ?? {});
	remote.deleteNodeStructure.mockResolvedValue(undefined);
	remote.createSlotDivider.mockResolvedValue(dataFor('createSlotDivider').divider ?? {});
	remote.deleteSlotDivider.mockResolvedValue(undefined);
	remote.upsertSlotClipNumber.mockResolvedValue({});
}

const config = {
	uuid: 'cfg-1',
	total_slots: 12,
	container: { display_name: 'Rack A > Einschub 1' }
};

function structure(uuid: string, slotStart: number, slotEnd: number) {
	return {
		uuid,
		slot_start: slotStart,
		slot_end: slotEnd,
		component_type: { id: 1, component_type: 'Kassette' },
		component_structure: null,
		purpose: 'component',
		label: null
	};
}

async function readyManager(): Promise<NodeStructureManager> {
	mockRoutes({
		'?/getSlotConfigurationsForNode': { data: { configurations: [config] } }
	});
	const manager = new NodeStructureManager('node-1');
	await manager.fetchSlotConfigurations();
	Object.values(remote).forEach((fn) => fn.mockClear());
	return manager;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	mockRoutes({});
});

afterEach(() => {
	vi.restoreAllMocks();
	Object.values(remote).forEach((fn) => fn.mockReset());
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(globalToaster.warning).mockClear();
});

describe('fetchSlotConfigurations', () => {
	test('should load configurations and select the first one', async () => {
		const manager = await readyManager();

		expect(manager.slotConfigurations).toEqual([config]);
		expect(manager.selectedSlotConfigUuid).toBe('cfg-1');
		expect(manager.selectedConfig).toEqual(config);
		expect(manager.containerPath).toBe('Rack A > Einschub 1');
		expect(manager.loading).toBe(false);
	});

	test('should use shared slot state without fetching', async () => {
		const manager = new NodeStructureManager('node-1', null, {
			nodeUuid: 'node-1',
			slotConfigurations: [config]
		});

		await manager.fetchSlotConfigurations();

		expect(remote.getSlotConfigurationsForNode).not.toHaveBeenCalled();
		expect(manager.slotConfigurations).toEqual([config]);
		expect(manager.selectedSlotConfigUuid).toBe('cfg-1');
	});

	test('should ignore shared state belonging to another node', async () => {
		mockRoutes({
			'?/getSlotConfigurationsForNode': { type: 'success', data: { configurations: [config] } }
		});
		const manager = new NodeStructureManager('node-1', null, {
			nodeUuid: 'other-node',
			slotConfigurations: [{ uuid: 'foreign', total_slots: 4 }]
		});

		await manager.fetchSlotConfigurations();

		expect(remote.getSlotConfigurationsForNode).toHaveBeenCalled();
		expect(manager.slotConfigurations).toEqual([config]);
	});

	test('should toast an error and clear configurations on failure', async () => {
		remote.getSlotConfigurationsForNode.mockRejectedValue(new Error('nope'));
		const manager = new NodeStructureManager('node-1');

		await manager.fetchSlotConfigurations();

		expect(globalToaster.error).toHaveBeenCalled();
		expect(manager.slotConfigurations).toEqual([]);
	});

	test('should do nothing without a node uuid', async () => {
		const manager = new NodeStructureManager();

		await manager.fetchSlotConfigurations();

		expect(remote.getSlotConfigurationsForNode).not.toHaveBeenCalled();
	});
});

describe('fetchAllForSlotConfig', () => {
	test('should load structures, dividers, and clip numbers together', async () => {
		const manager = await readyManager();
		mockRoutes({
			'?/getNodeStructures': { type: 'success', data: { structures: [structure('s1', 1, 4)] } },
			'?/getSlotDividers': {
				type: 'success',
				data: { dividers: [{ uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 4 }] }
			},
			'?/getSlotClipNumbers': {
				type: 'success',
				data: { clipNumbers: [{ slot_number: 2, clip_number: 'K-2' }] }
			}
		});

		await manager.fetchAllForSlotConfig();

		expect(manager.structures).toEqual([structure('s1', 1, 4)]);
		expect(manager.dividerAfterSlots.has(4)).toBe(true);
		expect(manager.clipNumbers.get(2)).toBe('K-2');
	});

	test('should clear structures when no slot config is selected', async () => {
		const manager = new NodeStructureManager('node-1');

		await manager.fetchAllForSlotConfig();

		expect(remote.getNodeStructures).not.toHaveBeenCalled();
		expect(manager.structures).toEqual([]);
	});
});

describe('occupiedSlots', () => {
	test('should map every slot of every structure to its uuid', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2), structure('s2', 5, 5)];

		expect(manager.occupiedSlots.get(1)).toBe('s1');
		expect(manager.occupiedSlots.get(2)).toBe('s1');
		expect(manager.occupiedSlots.get(5)).toBe('s2');
		expect(manager.occupiedSlots.has(3)).toBe(false);
	});
});

describe('createStructure', () => {
	test('should place the component and replace the optimistic entry', async () => {
		const manager = await readyManager();
		mockRoutes({
			'?/createNodeStructure': { type: 'success', data: { structure: structure('real-1', 3, 6) } }
		});

		await manager.createStructure({ id: 1, name: 'Kassette', occupied_slots: 4 }, 3);

		expect(manager.structures).toEqual([structure('real-1', 3, 6)]);
		expect(globalToaster.success).toHaveBeenCalled();

		expect(remote.createNodeStructure).toHaveBeenCalledWith(
			expect.objectContaining({ slotStart: 3, slotEnd: 6 })
		);
	});

	test('should reject placements beyond the last slot', async () => {
		const manager = await readyManager();

		await manager.createStructure({ id: 1, name: 'Kassette', occupied_slots: 4 }, 11);

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'message_error_not_enough_slots' })
		);
		expect(remote.createNodeStructure).not.toHaveBeenCalled();
	});

	test('should reject placements on occupied slots', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 4, 5)];

		await manager.createStructure({ id: 1, name: 'Kassette', occupied_slots: 2 }, 5);

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'message_error_slots_occupied' })
		);
		expect(remote.createNodeStructure).not.toHaveBeenCalled();
	});

	test('should roll back the optimistic entry and rethrow on failure', async () => {
		const manager = await readyManager();
		remote.createNodeStructure.mockRejectedValue(new Error('Backend sagt nein'));

		await expect(
			manager.createStructure({ id: 1, name: 'Kassette', occupied_slots: 2 }, 1)
		).rejects.toThrow('Backend sagt nein');

		expect(manager.structures).toEqual([]);
	});
});

describe('createMultipleStructures', () => {
	test('should bulk create and toast the created count', async () => {
		const manager = await readyManager();
		const created = [structure('r1', 1, 2), structure('r2', 3, 4)];
		mockRoutes({
			'?/bulkCreateNodeStructures': { type: 'success', data: { created, failed: [] } }
		});

		await manager.createMultipleStructures(
			{ id: 1, name: 'Kassette', occupied_slots: 2, count: 2 },
			1
		);

		expect(manager.structures).toEqual(created);
		expect(globalToaster.success).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'message_success_placing_components:2' })
		);
		expect(manager.creatingMultiple).toBe(false);
	});

	test('should warn about partially failed placements', async () => {
		const manager = await readyManager();
		mockRoutes({
			'?/bulkCreateNodeStructures': {
				type: 'success',
				data: { created: [structure('r1', 1, 2)], failed: [{ slot_start: 3, slot_end: 4 }] }
			}
		});

		await manager.createMultipleStructures(
			{ id: 1, name: 'Kassette', occupied_slots: 2, count: 2 },
			1
		);

		expect(globalToaster.warning).toHaveBeenCalledWith(
			expect.objectContaining({ description: expect.stringContaining('Failed: 3-4') })
		);
	});

	test('should throw when every placement fails', async () => {
		const manager = await readyManager();
		mockRoutes({
			'?/bulkCreateNodeStructures': {
				type: 'success',
				data: { created: [], failed: [{ slot_start: 1, slot_end: 2 }] }
			}
		});

		await expect(
			manager.createMultipleStructures({ id: 1, name: 'Kassette', occupied_slots: 2, count: 1 }, 1)
		).rejects.toThrow('All placements failed: 1-2');

		expect(manager.structures).toEqual([]);
	});

	test('should reject multi placements that do not fit', async () => {
		const manager = await readyManager();

		await manager.createMultipleStructures(
			{ id: 1, name: 'Kassette', occupied_slots: 4, count: 4 },
			1
		);

		expect(remote.bulkCreateNodeStructures).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('moveStructure', () => {
	test('should move the structure and adopt the server version', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];
		mockRoutes({
			'?/moveNodeStructure': { type: 'success', data: { structure: structure('s1', 5, 6) } }
		});

		await manager.moveStructure({ uuid: 's1', occupied_slots: 2 }, 5);

		expect(manager.structures).toEqual([structure('s1', 5, 6)]);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should allow moving over slots occupied by the structure itself', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];
		mockRoutes({
			'?/moveNodeStructure': { type: 'success', data: { structure: structure('s1', 2, 3) } }
		});

		await manager.moveStructure({ uuid: 's1', occupied_slots: 2 }, 2);

		expect(remote.moveNodeStructure).toHaveBeenCalled();
	});

	test('should reject moves onto foreign structures', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2), structure('s2', 4, 5)];

		await manager.moveStructure({ uuid: 's1', occupied_slots: 2 }, 4);

		expect(remote.moveNodeStructure).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalled();
	});

	test('should roll back on failure', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];
		remote.moveNodeStructure.mockRejectedValue(new Error('nein'));

		await expect(manager.moveStructure({ uuid: 's1', occupied_slots: 2 }, 5)).rejects.toThrow(
			'nein'
		);

		expect(manager.structures).toEqual([structure('s1', 1, 2)]);
	});
});

describe('deleteStructure', () => {
	test('should delete and report success', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];
		mockRoutes({ '?/deleteNodeStructure': { type: 'success', data: {} } });

		await expect(manager.deleteStructure('s1')).resolves.toBe(true);

		expect(manager.structures).toEqual([]);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should restore the structure and report failure', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];
		remote.deleteNodeStructure.mockRejectedValue(new Error('nein'));

		await expect(manager.deleteStructure('s1')).resolves.toBe(false);

		expect(manager.structures).toEqual([structure('s1', 1, 2)]);
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('toggleDivider', () => {
	test('should create a divider and adopt the server version', async () => {
		const manager = await readyManager();
		mockRoutes({
			'?/createSlotDivider': {
				type: 'success',
				data: { divider: { uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 3 } }
			}
		});

		await manager.toggleDivider(3);

		expect(manager.dividers).toEqual([{ uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 3 }]);
	});

	test('should delete an existing divider', async () => {
		const manager = await readyManager();
		manager.dividers = [{ uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 3 }];
		mockRoutes({ '?/deleteSlotDivider': { type: 'success', data: {} } });

		await manager.toggleDivider(3);

		expect(manager.dividers).toEqual([]);
	});

	test('should roll back a failed divider creation and toast', async () => {
		const manager = await readyManager();
		remote.createSlotDivider.mockRejectedValue(new Error('nein'));

		await manager.toggleDivider(3);

		expect(manager.dividers).toEqual([]);
		expect(globalToaster.error).toHaveBeenCalled();
	});

	test('should restore a divider when deletion fails', async () => {
		const manager = await readyManager();
		manager.dividers = [{ uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 3 }];
		remote.deleteSlotDivider.mockRejectedValue(new Error('nein'));

		await manager.toggleDivider(3);

		expect(manager.dividers).toEqual([{ uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 3 }]);
	});
});

describe('saveClipNumber', () => {
	test('should persist the clip number', async () => {
		const manager = await readyManager();
		mockRoutes({ '?/upsertSlotClipNumber': { type: 'success', data: {} } });

		await manager.saveClipNumber(2, ' K-2 ');

		expect(manager.clipNumbers.get(2)).toBe('K-2');
		expect(remote.upsertSlotClipNumber).toHaveBeenCalledWith(
			expect.objectContaining({ slotNumber: 2, clipNumber: 'K-2' })
		);
	});

	test('should ignore empty clip numbers', async () => {
		const manager = await readyManager();

		await manager.saveClipNumber(2, '   ');

		expect(remote.upsertSlotClipNumber).not.toHaveBeenCalled();
	});

	test('should roll back on failure', async () => {
		const manager = await readyManager();
		manager.clipNumbers = new Map([[2, 'Alt']]);
		remote.upsertSlotClipNumber.mockRejectedValue(new Error('nein'));

		await manager.saveClipNumber(2, 'Neu');

		expect(manager.clipNumbers.get(2)).toBe('Alt');
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('computeSlotRows', () => {
	test('should describe every slot with structure, divider, and clip info', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 2, 3)];
		manager.dividers = [{ uuid: 'd1', slot_configuration: 'cfg-1', after_slot: 3 }];
		manager.clipNumbers = new Map([[1, 'K-1']]);

		const rows = manager.computeSlotRows();

		expect(rows).toHaveLength(12);
		expect(rows[0]).toEqual({
			slotNumber: 1,
			structure: undefined,
			isBlockStart: false,
			blockSize: 0,
			isOccupied: false,
			hasDividerAfter: false,
			clipNumber: 'K-1'
		});
		expect(rows[1]).toMatchObject({
			slotNumber: 2,
			isBlockStart: true,
			blockSize: 2,
			isOccupied: true
		});
		expect(rows[2]).toMatchObject({ slotNumber: 3, isBlockStart: false, hasDividerAfter: true });
	});

	test('should return no rows without a selected configuration', () => {
		const manager = new NodeStructureManager('node-1');

		expect(manager.computeSlotRows()).toEqual([]);
	});
});

describe('syncWithSharedState', () => {
	test('should ignore state for another node', async () => {
		const manager = await readyManager();

		manager.syncWithSharedState({ nodeUuid: 'other', slotConfigurations: [] });

		expect(manager.selectedSlotConfigUuid).toBe('cfg-1');
	});

	test('should switch to the first configuration when the current one is gone', async () => {
		const manager = await readyManager();
		const newConfig = { uuid: 'cfg-2', total_slots: 6 };

		manager.syncWithSharedState({ nodeUuid: 'node-1', slotConfigurations: [newConfig] });

		expect(manager.selectedSlotConfigUuid).toBe('cfg-2');
		expect(manager.slotConfigurations).toEqual([newConfig]);
	});
});

describe('setNodeUuid and cleanup', () => {
	test('should reset all state for a new node', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];

		manager.setNodeUuid('node-2');

		expect(manager.nodeUuid).toBe('node-2');
		expect(manager.structures).toEqual([]);
		expect(manager.selectedSlotConfigUuid).toBeNull();
		expect(manager.loading).toBe(true);
	});

	test('should clear everything on cleanup', async () => {
		const manager = await readyManager();
		manager.structures = [structure('s1', 1, 2)];

		manager.cleanup();

		expect(manager.nodeUuid).toBeNull();
		expect(manager.structures).toEqual([]);
		expect(manager.loading).toBe(false);
	});
});
