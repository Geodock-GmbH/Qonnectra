import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import { FiberSpliceManager } from './FiberSpliceManager.svelte';

// Splice/fiber reads and writes run through remote-function modules; mock them
// so the class's calls are observable without a running server.
const remote = {
	getComponentPorts: vi.fn(),
	getFiberSplices: vi.fn(),
	upsertFiberSplice: vi.fn(),
	bulkUpsertFiberSplices: vi.fn(),
	clearFiberSplice: vi.fn(),
	mergePorts: vi.fn(),
	unmergePorts: vi.fn(),
	upsertMergedSplice: vi.fn(),
	getFiberColors: vi.fn(),
	getFibersForCable: vi.fn()
};

vi.mock('$lib/remote/network-schema/fiber-splices.remote', () => ({
	getComponentPorts: (...a: unknown[]) => remote.getComponentPorts(...a),
	getFiberSplices: (...a: unknown[]) => remoteQueryStub(remote.getFiberSplices)(...a),
	upsertFiberSplice: (...a: unknown[]) => remote.upsertFiberSplice(...a),
	bulkUpsertFiberSplices: (...a: unknown[]) => remote.bulkUpsertFiberSplices(...a),
	clearFiberSplice: (...a: unknown[]) => remote.clearFiberSplice(...a),
	mergePorts: (...a: unknown[]) => remote.mergePorts(...a),
	unmergePorts: (...a: unknown[]) => remote.unmergePorts(...a),
	upsertMergedSplice: (...a: unknown[]) => remote.upsertMergedSplice(...a)
}));

vi.mock('$lib/remote/network-schema/fibers.remote', () => ({
	getFiberColors: (...a: unknown[]) => remote.getFiberColors(...a),
	getFibersForCable: (...a: unknown[]) => remote.getFibersForCable(...a)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		info: vi.fn()
	}
}));

/**
 * Maps the old `{ '?/action': { data } }` shape onto the remote-fn mocks: each
 * listed action's remote fn resolves to that entry's unwrapped `data`. Reads
 * return the bare array (ports/splices/fiberColors/fibers); writes return the
 * inner object (splice / {created,failed} / {deleted} / merged results).
 */
function mockRoutes(routes: Record<string, { type?: string; data?: Record<string, unknown> }>) {
	const dataFor = (name: string) => routes[`?/${name}`]?.data ?? {};
	remote.getComponentPorts.mockResolvedValue(
		(dataFor('getComponentPorts').ports as unknown[]) ?? []
	);
	remote.getFiberSplices.mockResolvedValue((dataFor('getFiberSplices').splices as unknown[]) ?? []);
	remote.getFiberColors.mockResolvedValue(
		(dataFor('getFiberColors').fiberColors as unknown[]) ?? []
	);
	remote.getFibersForCable.mockResolvedValue(
		(dataFor('getFibersForCable').fibers as unknown[]) ?? []
	);
	remote.upsertFiberSplice.mockResolvedValue(dataFor('upsertFiberSplice').splice ?? {});
	remote.bulkUpsertFiberSplices.mockResolvedValue({
		created: (dataFor('bulkUpsertFiberSplices').created as unknown[]) ?? [],
		failed: (dataFor('bulkUpsertFiberSplices').failed as unknown[]) ?? []
	});
	remote.clearFiberSplice.mockResolvedValue({
		deleted: dataFor('clearFiberSplice').deleted ?? 0
	});
	remote.mergePorts.mockResolvedValue(dataFor('mergePorts'));
	remote.unmergePorts.mockResolvedValue(dataFor('unmergePorts'));
	remote.upsertMergedSplice.mockResolvedValue(dataFor('upsertMergedSplice'));
}

function makePorts(count: number) {
	const ports = [];
	for (let port = 1; port <= count; port++) {
		ports.push({ id: port, port, in_or_out: 'in' as const });
		ports.push({ id: 100 + port, port, in_or_out: 'out' as const });
	}
	return ports;
}

function fiberDetails(uuid: string, fiberNumber: number) {
	return {
		uuid,
		fiber_number: fiberNumber,
		fiber_color: 'rot',
		bundle_number: 1,
		cable_name: 'K-Nord'
	};
}

function emptySplice(portNumber: number, overrides: Record<string, unknown> = {}) {
	return {
		uuid: `splice-${portNumber}`,
		port_number: portNumber,
		fiber_a_details: null,
		fiber_b_details: null,
		residential_unit_a_details: null,
		residential_unit_b_details: null,
		merge_group_a: null,
		merge_group_b: null,
		merge_group_a_info: null,
		merge_group_b_info: null,
		...overrides
	};
}

const structure = {
	uuid: 'structure-1',
	component_type: { id: 5, component_type: 'Kassette' },
	slot_start: 1
};

function readyManager(portCount = 4): FiberSpliceManager {
	const manager = new FiberSpliceManager();
	manager.selectedStructure = structure as never;
	manager.componentPorts = makePorts(portCount) as never;
	manager.fiberSplices = [];
	return manager;
}

const fiberDrop = {
	type: 'fiber' as const,
	uuid: 'fiber-1',
	fiber_number: 3,
	fiber_color: 'rot',
	bundle_number: 1,
	cable_name: 'K-Nord',
	cable_uuid: 'cable-1'
};

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// Default every remote fn to an empty-success value; individual tests seed
	// specifics via mockRoutes.
	mockRoutes({});
});

afterEach(() => {
	vi.restoreAllMocks();
	Object.values(remote).forEach((fn) => fn.mockReset());
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(globalToaster.warning).mockClear();
	vi.mocked(globalToaster.info).mockClear();
});

describe('portRows', () => {
	test('should build a row per port up to the maximum port number', () => {
		const manager = readyManager(2);
		manager.fiberSplices = [
			emptySplice(2, { fiber_a_details: fiberDetails('fiber-1', 3) })
		] as never;

		const rows = manager.portRows;

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			portNumber: 1,
			hasInPort: true,
			hasOutPort: true,
			fiberA: null
		});
		expect(rows[1].fiberA).toEqual(fiberDetails('fiber-1', 3));
	});

	test('should return no rows without component ports', () => {
		const manager = new FiberSpliceManager();

		expect(manager.portRows).toEqual([]);
	});
});

describe('portRowsWithMerge', () => {
	test('should annotate merge groups with range and first-in-group flag', () => {
		const manager = readyManager(3);
		manager.fiberSplices = [
			emptySplice(1, {
				merge_group_a: 'g1',
				fiber_a_details: fiberDetails('fiber-1', 1)
			}),
			emptySplice(2, { merge_group_a: 'g1' }),
			emptySplice(3)
		] as never;

		const rows = manager.portRowsWithMerge;

		expect(rows[0].mergeInfoA).toMatchObject({
			groupId: 'g1',
			isFirstInGroup: true,
			groupSize: 2,
			portRange: '1-2',
			fiberCount: 1
		});
		expect(rows[1].mergeInfoA).toMatchObject({ isFirstInGroup: false });
		expect(rows[2].mergeInfoA).toBeNull();
		expect(rows[0].mergeInfoB).toBeNull();
	});
});

describe('selectStructure', () => {
	test('should load ports, splices, and colors for a new structure', async () => {
		mockRoutes({
			'?/getComponentPorts': { type: 'success', data: { ports: makePorts(2) } },
			'?/getFiberSplices': { type: 'success', data: { splices: [emptySplice(1)] } },
			'?/getFiberColors': {
				type: 'success',
				data: {
					fiberColors: [{ name_de: 'rot', name_en: 'red', hex_code: '#ff0000', display_order: 1 }]
				}
			}
		});
		const manager = new FiberSpliceManager();

		const selected = await manager.selectStructure(structure as never);

		expect(selected).toBe(true);
		expect(manager.componentPorts).toHaveLength(4);
		expect(manager.fiberSplices).toHaveLength(1);
		expect(manager.fiberColors).toHaveLength(1);
		expect(manager.loadingPorts).toBe(false);
	});

	test('should deselect when selecting the same structure again', async () => {
		const manager = readyManager();

		const selected = await manager.selectStructure(structure as never);

		expect(selected).toBe(false);
		expect(manager.selectedStructure).toBeNull();
		expect(manager.componentPorts).toEqual([]);
	});

	test('should block switching during a bulk operation', async () => {
		const manager = readyManager();
		manager.bulkOperationInProgress = true;

		const selected = await manager.selectStructure({ ...structure, uuid: 'other' } as never);

		expect(selected).toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});
});

describe('getAvailablePorts', () => {
	test('should return consecutive free ports and stop at the first occupied one', () => {
		const manager = readyManager(4);
		manager.fiberSplices = [
			emptySplice(3, { fiber_a_details: fiberDetails('fiber-x', 1) })
		] as never;

		expect(manager.getAvailablePorts('a', 1)).toEqual([1, 2]);
		expect(manager.getAvailablePorts('b', 1)).toEqual([1, 2, 3, 4]);
		expect(manager.getAvailablePorts('a', 4)).toEqual([4]);
	});
});

describe('handleSingleFiberDrop', () => {
	test('should create a splice optimistically and adopt the server version', async () => {
		const serverSplice = emptySplice(2, { fiber_a_details: fiberDetails('fiber-1', 3) });
		mockRoutes({ '?/upsertFiberSplice': { type: 'success', data: { splice: serverSplice } } });
		const manager = readyManager();
		const eventSpy = vi.fn();
		window.addEventListener('fiberSpliceChanged', eventSpy);

		const success = await manager.handleSingleFiberDrop(2, 'a', fiberDrop);

		expect(success).toBe(true);
		expect(manager.fiberSplices).toEqual([serverSplice]);
		expect(globalToaster.success).toHaveBeenCalled();
		expect(eventSpy).toHaveBeenCalled();

		expect(remote.upsertFiberSplice).toHaveBeenCalledWith(
			expect.objectContaining({ portNumber: 2, side: 'a', fiberUuid: 'fiber-1' })
		);
		window.removeEventListener('fiberSpliceChanged', eventSpy);
	});

	test('should update an existing splice on the given side', async () => {
		const serverSplice = emptySplice(1, {
			fiber_a_details: fiberDetails('fiber-old', 1),
			fiber_b_details: fiberDetails('fiber-1', 3)
		});
		mockRoutes({ '?/upsertFiberSplice': { type: 'success', data: { splice: serverSplice } } });
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, { fiber_a_details: fiberDetails('fiber-old', 1) })
		] as never;

		await manager.handleSingleFiberDrop(1, 'b', fiberDrop);

		expect(manager.fiberSplices).toEqual([serverSplice]);
	});

	test('should roll back and toast on failure', async () => {
		remote.upsertFiberSplice.mockRejectedValue(new Error('Belegt'));
		const manager = readyManager();

		const success = await manager.handleSingleFiberDrop(2, 'a', fiberDrop);

		expect(success).toBe(false);
		expect(manager.fiberSplices).toEqual([]);
		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Belegt' })
		);
	});

	test('should refetch all splices when the port is part of a merge group', async () => {
		mockRoutes({
			'?/upsertFiberSplice': { type: 'success', data: {} },
			'?/getFiberSplices': { type: 'success', data: { splices: [emptySplice(1)] } }
		});
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, { merge_group_a: 'g1' }),
			emptySplice(2, { merge_group_a: 'g1' })
		] as never;

		await manager.handleSingleFiberDrop(1, 'a', fiberDrop);

		expect(remote.getFiberSplices).toHaveBeenCalled();
	});
});

describe('handleFiberMove', () => {
	test('should place at the target and clear the source', async () => {
		const serverSplice = emptySplice(3, { fiber_a_details: fiberDetails('fiber-1', 3) });
		mockRoutes({
			'?/upsertFiberSplice': { type: 'success', data: { splice: serverSplice } },
			'?/clearFiberSplice': { type: 'success', data: {} }
		});
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, { fiber_a_details: fiberDetails('fiber-1', 3) })
		] as never;

		const success = await manager.handleFiberMove(1, 'a', 3, 'a', {
			...fiberDrop,
			isMove: true,
			sourcePortNumber: 1,
			sourceSide: 'a'
		});

		expect(success).toBe(true);
		expect(remote.upsertFiberSplice).toHaveBeenCalled();
		expect(remote.clearFiberSplice).toHaveBeenCalled();
	});

	test('should be a no-op when source and target are identical', async () => {
		const manager = readyManager();

		const success = await manager.handleFiberMove(1, 'a', 1, 'a', fiberDrop);

		expect(success).toBe(false);
		expect(remote.upsertFiberSplice).not.toHaveBeenCalled();
		expect(remote.clearFiberSplice).not.toHaveBeenCalled();
	});
});

describe('handleBundleDrop', () => {
	const bundleDrop = {
		type: 'bundle' as const,
		cable_uuid: 'cable-1',
		cable_name: 'K-Nord',
		fibers: [
			{ uuid: 'fiber-2', fiber_number_absolute: 2, fiber_color: 'grün', bundle_number: 1 },
			{ uuid: 'fiber-1', fiber_number_absolute: 1, fiber_color: 'rot', bundle_number: 1 }
		]
	};

	test('should bulk connect fibers sorted by fiber number to sequential ports', async () => {
		const created = [
			emptySplice(1, { fiber_a_details: fiberDetails('fiber-1', 1) }),
			emptySplice(2, { fiber_a_details: fiberDetails('fiber-2', 2) })
		];
		mockRoutes({ '?/bulkUpsertFiberSplices': { type: 'success', data: { created, failed: [] } } });
		const manager = readyManager();

		const success = await manager.handleBundleDrop(1, 'a', bundleDrop);

		expect(success).toBe(true);
		expect(manager.fiberSplices).toEqual(created);
		expect(manager.bulkOperationInProgress).toBe(false);

		const splices = remote.bulkUpsertFiberSplices.mock.calls[0][0] as {
			fiber_uuid: string;
			port_number: number;
		}[];
		expect(splices.map((s) => s.fiber_uuid)).toEqual(['fiber-1', 'fiber-2']);
		expect(splices.map((s) => s.port_number)).toEqual([1, 2]);
	});

	test('should warn for an empty bundle', async () => {
		const manager = readyManager();

		const success = await manager.handleBundleDrop(1, 'a', { ...bundleDrop, fibers: [] });

		expect(success).toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});

	test('should warn when no ports are available', async () => {
		const manager = readyManager(1);
		manager.fiberSplices = [
			emptySplice(1, { fiber_a_details: fiberDetails('fiber-x', 9) })
		] as never;

		const success = await manager.handleBundleDrop(1, 'a', bundleDrop);

		expect(success).toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});

	test('should roll back on failure', async () => {
		remote.bulkUpsertFiberSplices.mockRejectedValue(new Error('nein'));
		const manager = readyManager();

		const success = await manager.handleBundleDrop(1, 'a', bundleDrop);

		expect(success).toBe(false);
		expect(manager.fiberSplices).toEqual([]);
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('handleCableDrop', () => {
	const cableDrop = {
		type: 'cable' as const,
		uuid: 'cable-1',
		fibers: [
			{ uuid: 'fiber-1', fiber_number_absolute: 1, fiber_color: 'rot', bundle_number: 1 },
			{ uuid: 'fiber-2', fiber_number_absolute: 2, fiber_color: 'grün', bundle_number: 1 }
		]
	};

	test('should fill the selected structure with cable fibers', async () => {
		const created = [
			emptySplice(1, { fiber_a_details: fiberDetails('fiber-1', 1) }),
			emptySplice(2, { fiber_a_details: fiberDetails('fiber-2', 2) })
		];
		mockRoutes({ '?/bulkUpsertFiberSplices': { type: 'success', data: { created, failed: [] } } });
		const manager = readyManager();

		const success = await manager.handleCableDrop(1, 'a', cableDrop, [structure as never]);

		expect(success).toBe(true);
		expect(manager.fiberSplices).toEqual(created);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should lazily fetch fibers when the drop payload has none', async () => {
		mockRoutes({
			'?/getFibersForCable': { type: 'success', data: { fibers: cableDrop.fibers } },
			'?/bulkUpsertFiberSplices': {
				type: 'success',
				data: { created: [emptySplice(1)], failed: [] }
			}
		});
		const manager = readyManager();

		const success = await manager.handleCableDrop(
			1,
			'a',
			{ type: 'cable', uuid: 'cable-1', fibers: [] },
			[structure as never]
		);

		expect(success).toBe(true);
		expect(remote.getFibersForCable).toHaveBeenCalledWith('cable-1');
	});

	test('should warn when the cable has no fibers at all', async () => {
		mockRoutes({ '?/getFibersForCable': { type: 'success', data: { fibers: [] } } });
		const manager = readyManager();

		const success = await manager.handleCableDrop(
			1,
			'a',
			{ type: 'cable', uuid: 'cable-1', fibers: [] },
			[]
		);

		expect(success).toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});
});

describe('handleResidentialUnitDrop', () => {
	const unitDrop = {
		type: 'residential_unit' as const,
		uuid: 'ru-1',
		id_residential_unit: 7,
		display_name: 'WE-07'
	};

	test('should connect the unit and adopt the server splice', async () => {
		const serverSplice = emptySplice(1, {
			residential_unit_b_details: { uuid: 'ru-1', id_residential_unit: 7, display_name: 'WE-07' }
		});
		mockRoutes({ '?/upsertFiberSplice': { type: 'success', data: { splice: serverSplice } } });
		const manager = readyManager();
		const eventSpy = vi.fn();
		window.addEventListener('residentialUnitSpliceChanged', eventSpy);

		const success = await manager.handleResidentialUnitDrop(1, 'b', unitDrop);

		expect(success).toBe(true);
		expect(manager.fiberSplices).toEqual([serverSplice]);
		expect(eventSpy).toHaveBeenCalled();
		window.removeEventListener('residentialUnitSpliceChanged', eventSpy);
	});

	test('should roll back on failure', async () => {
		remote.upsertFiberSplice.mockRejectedValue(new Error('nein'));
		const manager = readyManager();

		const success = await manager.handleResidentialUnitDrop(1, 'b', unitDrop);

		expect(success).toBe(false);
		expect(manager.fiberSplices).toEqual([]);
	});
});

describe('handleAddressDrop', () => {
	test('should bulk connect all residential units sorted by unit id', async () => {
		const created = [emptySplice(1), emptySplice(2)];
		mockRoutes({ '?/bulkUpsertFiberSplices': { type: 'success', data: { created, failed: [] } } });
		const manager = readyManager();

		const success = await manager.handleAddressDrop(1, 'b', {
			type: 'address',
			residential_units: [
				{ uuid: 'ru-2', id_residential_unit: 2, display_name: 'WE-02' },
				{ uuid: 'ru-1', id_residential_unit: 1, display_name: 'WE-01' }
			]
		});

		expect(success).toBe(true);
		const splices = remote.bulkUpsertFiberSplices.mock.calls[0][0] as {
			residential_unit_uuid: string;
		}[];
		expect(splices.map((s) => s.residential_unit_uuid)).toEqual(['ru-1', 'ru-2']);
	});

	test('should warn for an address without units', async () => {
		const manager = readyManager();

		const success = await manager.handleAddressDrop(1, 'b', {
			type: 'address',
			residential_units: []
		});

		expect(success).toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});
});

describe('handlePortDrop routing', () => {
	test('should warn for unsupported drop types', async () => {
		const manager = readyManager();

		const success = await manager.handlePortDrop(1, 'a', { type: 'unknown' } as never);

		expect(success).toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});
});

describe('handleClearPort', () => {
	test('should clear one side and drop empty splices', async () => {
		mockRoutes({ '?/clearFiberSplice': { type: 'success', data: {} } });
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, { fiber_a_details: fiberDetails('fiber-1', 1) })
		] as never;

		await manager.handleClearPort(1, 'a');

		expect(manager.fiberSplices).toEqual([]);
	});

	test('should keep splices that still hold data on the other side', async () => {
		mockRoutes({ '?/clearFiberSplice': { type: 'success', data: {} } });
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, {
				fiber_a_details: fiberDetails('fiber-1', 1),
				fiber_b_details: fiberDetails('fiber-2', 2)
			})
		] as never;

		await manager.handleClearPort(1, 'a');

		expect(manager.fiberSplices).toHaveLength(1);
		expect(manager.fiberSplices[0].fiber_a_details).toBeNull();
		expect(manager.fiberSplices[0].fiber_b_details).not.toBeNull();
	});

	test('should roll back on failure', async () => {
		remote.clearFiberSplice.mockRejectedValue(new Error('nein'));
		const manager = readyManager();
		const splices = [emptySplice(1, { fiber_a_details: fiberDetails('fiber-1', 1) })];
		manager.fiberSplices = splices as never;

		await manager.handleClearPort(1, 'a');

		expect(manager.fiberSplices).toEqual(splices);
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('merge operations', () => {
	test('should toggle merge mode and clear selections when leaving', () => {
		const manager = readyManager();

		manager.toggleMergeSelectionMode();
		manager.togglePortSelection(1, 'a');
		manager.togglePortSelection(2, 'a');
		expect(manager.selectedForMerge.size).toBe(2);

		manager.toggleMergeSelectionMode();
		expect(manager.selectedForMerge.size).toBe(0);
	});

	test('should clear selections when the merge side changes', () => {
		const manager = readyManager();
		manager.togglePortSelection(1, 'a');

		manager.setMergeSide('b');

		expect(manager.mergeSide).toBe('b');
		expect(manager.selectedForMerge.size).toBe(0);
	});

	test('should refuse merging fewer than two ports', async () => {
		const manager = readyManager();
		manager.togglePortSelection(1, 'a');

		await expect(manager.mergeSelectedPorts()).resolves.toBe(false);
		expect(globalToaster.warning).toHaveBeenCalled();
	});

	test('should refuse merging non-consecutive ports', async () => {
		const manager = readyManager();
		manager.togglePortSelection(1, 'a');
		manager.togglePortSelection(3, 'a');

		await expect(manager.mergeSelectedPorts()).resolves.toBe(false);
		expect(remote.mergePorts).not.toHaveBeenCalled();
	});

	test('should merge consecutive ports and refresh splices', async () => {
		const manager = readyManager();
		manager.mergeSelectionMode = true;
		manager.togglePortSelection(1, 'a');
		manager.togglePortSelection(2, 'a');

		await expect(manager.mergeSelectedPorts()).resolves.toBe(true);

		expect(remote.mergePorts).toHaveBeenCalledWith(
			expect.objectContaining({ portNumbers: [1, 2] })
		);
		expect(manager.mergeSelectionMode).toBe(false);
		expect(manager.selectedForMerge.size).toBe(0);
	});

	test('should resolve group ports when unmerging without explicit ports', async () => {
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, {
				merge_group_a: 'g1',
				merge_group_a_info: { port_numbers: [1, 2], port_count: 2 }
			})
		] as never;

		await expect(manager.unmergePorts('g1')).resolves.toBe(true);

		expect(remote.unmergePorts).toHaveBeenCalledWith(
			expect.objectContaining({ portNumbers: [1, 2] })
		);
	});

	test('should route fiber drops on a merged group to its first port', async () => {
		const serverSplice = emptySplice(1, { fiber_a_details: fiberDetails('fiber-1', 3) });
		mockRoutes({ '?/upsertFiberSplice': { data: { splice: serverSplice } } });
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, {
				merge_group_a: 'g1',
				merge_group_a_info: { port_numbers: [1, 2], port_count: 2 }
			}),
			emptySplice(2, { merge_group_a: 'g1' })
		] as never;

		const success = await manager.handleMergedPortDrop('g1', 'a', fiberDrop);

		expect(success).toBe(true);
		expect(remote.upsertFiberSplice).toHaveBeenCalledWith(
			expect.objectContaining({ portNumber: 1 })
		);
	});

	test('should connect bundle fibers to a merged group via the merged endpoint', async () => {
		const manager = readyManager();
		manager.fiberSplices = [
			emptySplice(1, {
				merge_group_b: 'g1',
				merge_group_b_info: { port_numbers: [1, 2], port_count: 2 }
			})
		] as never;

		const success = await manager.handleMergedPortDrop('g1', 'b', {
			type: 'bundle',
			cable_uuid: 'cable-1',
			cable_name: 'K',
			fibers: [
				{ uuid: 'fiber-1', fiber_number_absolute: 1, fiber_color: 'rot', bundle_number: 1 },
				{ uuid: 'fiber-2', fiber_number_absolute: 2, fiber_color: 'grün', bundle_number: 1 },
				{ uuid: 'fiber-3', fiber_number_absolute: 3, fiber_color: 'blau', bundle_number: 1 }
			]
		});

		expect(success).toBe(true);
		const fibers = (remote.upsertMergedSplice.mock.calls[0][0] as { fibers: unknown[] }).fibers;
		expect(fibers).toHaveLength(2);
		expect(fibers[0]).toEqual({ uuid: 'fiber-1', cable_uuid: 'cable-1' });
	});
});

describe('lifecycle helpers', () => {
	test('closePortTable should clear the selection and data', () => {
		const manager = readyManager();
		manager.fiberSplices = [emptySplice(1)] as never;

		manager.closePortTable();

		expect(manager.selectedStructure).toBeNull();
		expect(manager.componentPorts).toEqual([]);
		expect(manager.fiberSplices).toEqual([]);
	});

	test('onStructureDeleted should only close the table for the selected structure', () => {
		const manager = readyManager();

		manager.onStructureDeleted('other-structure');
		expect(manager.selectedStructure).not.toBeNull();

		manager.onStructureDeleted('structure-1');
		expect(manager.selectedStructure).toBeNull();
	});

	test('cleanup should reset all state', () => {
		const manager = readyManager();
		manager.fiberColors = [
			{ name_de: 'rot', name_en: 'red', hex_code: '#ff0000', display_order: 1 }
		] as never;
		manager.togglePortSelection(1, 'a');
		manager.mergeSelectionMode = true;

		manager.cleanup();

		expect(manager.selectedStructure).toBeNull();
		expect(manager.fiberColors).toEqual([]);
		expect(manager.selectedForMerge.size).toBe(0);
		expect(manager.mergeSelectionMode).toBe(false);
	});
});
