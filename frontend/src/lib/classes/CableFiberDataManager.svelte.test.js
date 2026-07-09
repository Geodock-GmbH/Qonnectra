import { beforeEach, describe, expect, test, vi } from 'vitest';

import { CableFiberDataManager } from './CableFiberDataManager.svelte.js';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text) => JSON.parse(text))
}));

describe('CableFiberDataManager', () => {
	/** @type {CableFiberDataManager} */
	let manager;

	beforeEach(() => {
		manager = new CableFiberDataManager();
		manager.nodeUuid = 'node-1';
		vi.restoreAllMocks();
	});

	describe('fiber component info', () => {
		test('getFiberComponentInfo returns null for unknown fiber', () => {
			expect(manager.getFiberComponentInfo('unknown-uuid')).toBeNull();
		});

		test('getFiberComponentInfo returns component info after fetchFiberUsage', async () => {
			const mockResponse = {
				type: 'success',
				data: {
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
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
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
			const mockResponse = {
				type: 'success',
				data: {
					usedFiberUuids: ['fiber-1'],
					fiberComponentMap: {}
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
			});

			await manager.fetchFiberUsage();

			expect(manager.isFiberUsed('fiber-1')).toBe(true);
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});

		test('fiberComponentMap is empty when no data returned', async () => {
			const mockResponse = {
				type: 'success',
				data: {
					usedFiberUuids: ['fiber-1']
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
			});

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
			const mockResponse = {
				type: 'success',
				data: {
					used_uuids: ['ru-1', 'ru-2'],
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
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
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
			const mockResponse = {
				type: 'success',
				data: {
					used_uuids: ['ru-1']
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
			});

			await manager.fetchResidentialUnitUsage();

			expect(manager.isResidentialUnitUsed('ru-1')).toBe(true);
			expect(manager.getResidentialUnitComponentInfo('ru-1')).toBeNull();
		});
	});

	describe('getComponentDisplayLabel', () => {
		test('returns compact label with component type and TPU slot_start', () => {
			const info = { component_type: 'Spleißkassette', slot_start: 6, port_number: 1, side: 'A' };
			expect(manager.getComponentDisplayLabel(info)).toBe('Spleißkassette · TPU 6');
		});

		test('uses slot_start not port_number for TPU', () => {
			const info = { component_type: 'Splitter 1:8', slot_start: 12, port_number: 2, side: 'A' };
			expect(manager.getComponentDisplayLabel(info)).toBe('Splitter 1:8 · TPU 12');
		});

		test('returns null for null info', () => {
			expect(manager.getComponentDisplayLabel(null)).toBeNull();
		});
	});

	describe('setNodeUuid resets component maps', () => {
		test('component maps are cleared when node changes', async () => {
			const mockResponse = {
				type: 'success',
				data: {
					usedFiberUuids: ['fiber-1'],
					fiberComponentMap: {
						'fiber-1': { component_type: 'Test', slot_start: 1, port_number: 1, side: 'A' }
					}
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
			});

			await manager.fetchFiberUsage();
			expect(manager.getFiberComponentInfo('fiber-1')).not.toBeNull();

			manager.setNodeUuid('node-2');
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});
	});

	describe('cleanup resets component maps', () => {
		test('component maps are cleared on cleanup', async () => {
			const mockResponse = {
				type: 'success',
				data: {
					usedFiberUuids: ['fiber-1'],
					fiberComponentMap: {
						'fiber-1': { component_type: 'Test', slot_start: 1, port_number: 1, side: 'A' }
					}
				}
			};

			vi.spyOn(globalThis, 'fetch').mockResolvedValue({
				text: () => Promise.resolve(JSON.stringify(mockResponse))
			});

			await manager.fetchFiberUsage();
			expect(manager.getFiberComponentInfo('fiber-1')).not.toBeNull();

			manager.cleanup();
			expect(manager.getFiberComponentInfo('fiber-1')).toBeNull();
		});
	});
});
