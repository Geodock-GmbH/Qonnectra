import { beforeEach, describe, expect, test, vi } from 'vitest';

import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import { CableFiberDataManager } from './CableFiberDataManager.svelte';

// Reads run through the fibers.remote module; mock it so the class's calls are
// observable without a running server. Cached queries that are force-refreshed
// after mutations (cables, fiber usage, residential-unit usage) are wrapped as
// remote-query stubs so .refresh()/.current behave like the real functions.
const getCablesAtNode = vi.fn().mockResolvedValue([]);
const getFiberUsageInNode = vi.fn();
const getUsedResidentialUnits = vi.fn();

vi.mock('$lib/remote/network-schema/fibers.remote', () => ({
	getCablesAtNode: (...a: unknown[]) => remoteQueryStub(getCablesAtNode)(...a),
	getFibersForCable: vi.fn().mockResolvedValue([]),
	getFiberColors: vi.fn().mockResolvedValue([]),
	getFiberUsageInNode: (...a: unknown[]) => remoteQueryStub(getFiberUsageInNode)(...a),
	getAddressesForNode: vi.fn().mockResolvedValue([]),
	getUsedResidentialUnits: (...a: unknown[]) => remoteQueryStub(getUsedResidentialUnits)(...a),
	getFiberStatusOptions: vi.fn().mockResolvedValue([]),
	updateFiberStatus: vi.fn().mockResolvedValue(null)
}));

describe('CableFiberDataManager', () => {
	let manager: CableFiberDataManager;

	beforeEach(() => {
		manager = new CableFiberDataManager();
		manager.nodeUuid = 'node-1';
		vi.restoreAllMocks();
		getCablesAtNode.mockResolvedValue([]);
		getFiberUsageInNode.mockResolvedValue({ usedFiberUuids: [], fiberComponentMap: {} });
		getUsedResidentialUnits.mockResolvedValue({
			usedResidentialUnitUuids: [],
			residentialUnitComponentMap: {}
		});
	});

	describe('fiber component info', () => {
		test('getFiberComponentInfo returns null for unknown fiber', () => {
			expect(manager.getFiberComponentInfo('unknown-uuid')).toBeNull();
		});

		test('getFiberComponentInfo returns component info after fetchFiberUsage', async () => {
			getFiberUsageInNode.mockResolvedValue({
				usedFiberUuids: ['fiber-1', 'fiber-2'],
				fiberComponentMap: {
					'fiber-1': {
						component_type: 'Spleißkassette',
						slot_start: 6,
						port_number: 1,
						side: 'A'
					},
					'fiber-2': {
						component_type: 'Splitter 1:8',
						slot_start: 12,
						port_number: 2,
						side: 'B'
					}
				}
			});

			await manager.fetchFiberUsage();

			expect(manager.isFiberUsed('fiber-1')).toBe(true);
			expect(manager.isFiberUsed('fiber-2')).toBe(true);
			expect(manager.isFiberUsed('fiber-3')).toBe(false);

			const info1 = manager.getFiberComponentInfo('fiber-1');
			expect(info1).toEqual({
				component_type: 'Spleißkassette',
				slot_start: 6,
				port_number: 1,
				side: 'A'
			});

			const info2 = manager.getFiberComponentInfo('fiber-2');
			expect(info2).toEqual({
				component_type: 'Splitter 1:8',
				slot_start: 12,
				port_number: 2,
				side: 'B'
			});
		});

		test('getFiberComponentInfo returns null for used fiber without component info', async () => {
			getFiberUsageInNode.mockResolvedValue({
				usedFiberUuids: ['fiber-1'],
				fiberComponentMap: {}
			});

			await manager.fetchFiberUsage();

			expect(manager.isFiberUsed('fiber-1')).toBe(true);
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});

		test('fiberComponentMap is empty when no map data returned', async () => {
			getFiberUsageInNode.mockResolvedValue({ usedFiberUuids: ['fiber-1'], fiberComponentMap: {} });

			await manager.fetchFiberUsage();

			expect(manager.isFiberUsed('fiber-1')).toBe(true);
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});
	});

	describe('residential unit component info', () => {
		test('getResidentialUnitComponentInfo returns null for unknown unit', () => {
			expect(manager.getResidentialUnitComponentInfo('unknown-uuid')).toBeNull();
		});

		test('getResidentialUnitComponentInfo returns component info after fetchResidentialUnitUsage', async () => {
			getUsedResidentialUnits.mockResolvedValue({
				usedResidentialUnitUuids: ['ru-1', 'ru-2'],
				residentialUnitComponentMap: {
					'ru-1': {
						component_type: 'Splitter 1:8',
						slot_start: 5,
						port_number: 3,
						side: 'A'
					},
					'ru-2': {
						component_type: 'GF-GV (4 WE)',
						slot_start: 10,
						port_number: 1,
						side: 'B'
					}
				}
			});

			await manager.fetchResidentialUnitUsage();

			expect(manager.isResidentialUnitUsed('ru-1')).toBe(true);
			expect(manager.isResidentialUnitUsed('ru-2')).toBe(true);

			const info1 = manager.getResidentialUnitComponentInfo('ru-1');
			expect(info1).toEqual({
				component_type: 'Splitter 1:8',
				slot_start: 5,
				port_number: 3,
				side: 'A'
			});

			const info2 = manager.getResidentialUnitComponentInfo('ru-2');
			expect(info2).toEqual({
				component_type: 'GF-GV (4 WE)',
				slot_start: 10,
				port_number: 1,
				side: 'B'
			});
		});

		test('residentialUnitComponentMap is empty when no map data returned', async () => {
			getUsedResidentialUnits.mockResolvedValue({
				usedResidentialUnitUuids: ['ru-1'],
				residentialUnitComponentMap: {}
			});

			await manager.fetchResidentialUnitUsage();

			expect(manager.isResidentialUnitUsed('ru-1')).toBe(true);
			expect(manager.getResidentialUnitComponentInfo('ru-1')).toBeNull();
		});
	});

	describe('getComponentDisplayLabel', () => {
		test('returns label with component type, TPU slot_start and side', () => {
			const info = { component_type: 'Spleißkassette', slot_start: 6, port_number: 1, side: 'A' };
			expect(manager.getComponentDisplayLabel(info)).toBe('Spleißkassette · TPU 6 · Seite A');
		});

		test('includes side B in label', () => {
			const info = { component_type: 'Splitter 1:8', slot_start: 12, port_number: 2, side: 'B' };
			expect(manager.getComponentDisplayLabel(info)).toBe('Splitter 1:8 · TPU 12 · Seite B');
		});

		test('omits side when empty string', () => {
			const info = { component_type: 'Splitter 1:8', slot_start: 12, port_number: 2, side: '' };
			expect(manager.getComponentDisplayLabel(info)).toBe('Splitter 1:8 · TPU 12');
		});

		test('returns null for null info', () => {
			expect(manager.getComponentDisplayLabel(null)).toBeNull();
		});
	});

	describe('setNodeUuid resets component maps', () => {
		test('component maps are cleared when node changes', async () => {
			getFiberUsageInNode.mockResolvedValue({
				usedFiberUuids: ['fiber-1'],
				fiberComponentMap: {
					'fiber-1': { component_type: 'Test', slot_start: 1, port_number: 1, side: 'A' }
				}
			});

			await manager.fetchFiberUsage();
			expect(manager.getFiberComponentInfo('fiber-1')).not.toBeNull();

			manager.setNodeUuid('node-2');
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});
	});

	describe('cleanup resets component maps', () => {
		test('component maps are cleared on cleanup', async () => {
			getFiberUsageInNode.mockResolvedValue({
				usedFiberUuids: ['fiber-1'],
				fiberComponentMap: {
					'fiber-1': { component_type: 'Test', slot_start: 1, port_number: 1, side: 'A' }
				}
			});

			await manager.fetchFiberUsage();
			expect(manager.getFiberComponentInfo('fiber-1')).not.toBeNull();

			manager.cleanup();
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});
	});
});
