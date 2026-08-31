import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CableTrenchDataManager } from './CableTrenchDataManager.svelte';

// Reads run through fibers.remote; mock it so the class's calls are observable
// without a running server.
const getCablesInTrench = vi.fn();
const getFibersForCable = vi.fn();
const getFiberColors = vi.fn();

vi.mock('$lib/remote/network-schema/fibers.remote', () => ({
	getCablesInTrench: (...a: unknown[]) => getCablesInTrench(...a),
	getFibersForCable: (...a: unknown[]) => getFibersForCable(...a),
	getFiberColors: (...a: unknown[]) => getFiberColors(...a)
}));

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	localStorage.clear();
	getCablesInTrench.mockResolvedValue([]);
	getFibersForCable.mockResolvedValue([]);
	getFiberColors.mockResolvedValue([]);
});

afterEach(() => {
	vi.restoreAllMocks();
	getCablesInTrench.mockReset();
	getFibersForCable.mockReset();
	getFiberColors.mockReset();
});

describe('fetchCablesInTrench', () => {
	test('should map cables to display items with type in the title', async () => {
		getCablesInTrench.mockResolvedValue([
			{
				uuid: 'cable-1',
				name: 'K-Nord',
				cable_type: { cable_type: 'LWL 96' },
				fiber_count: 96
			},
			{ uuid: 'abcdef12-3456', name: null }
		]);
		const manager = new CableTrenchDataManager();

		await manager.fetchCablesInTrench('trench-1');

		expect(getCablesInTrench).toHaveBeenCalledWith('trench-1');
		expect(manager.loading).toBe(false);
		expect(manager.error).toBeNull();
		expect(manager.cablesInTrench).toEqual([
			{
				id: 'cable-1',
				title: 'K-Nord (LWL 96)',
				fiberCount: 96,
				data: {
					uuid: 'cable-1',
					name: 'K-Nord',
					cable_type: { cable_type: 'LWL 96' },
					fiber_count: 96
				},
				cableUuid: 'cable-1'
			},
			{
				id: 'abcdef12-3456',
				title: 'Cable abcdef12',
				fiberCount: 0,
				data: { uuid: 'abcdef12-3456', name: null },
				cableUuid: 'abcdef12-3456'
			}
		]);
	});

	test('should do nothing without a trench uuid', async () => {
		const manager = new CableTrenchDataManager();

		await manager.fetchCablesInTrench('');

		expect(getCablesInTrench).not.toHaveBeenCalled();
	});

	test('should store a generic message when the fetch fails', async () => {
		getCablesInTrench.mockRejectedValue(new Error('No access'));
		const manager = new CableTrenchDataManager();

		await manager.fetchCablesInTrench('trench-1');

		expect(manager.error).toBe('Failed to load cables');
		expect(manager.cablesInTrench).toEqual([]);
		expect(manager.loading).toBe(false);
	});
});

describe('fetchFibersForCable', () => {
	test('should load and cache fibers per cable', async () => {
		getFibersForCable.mockResolvedValue([{ fiber_number: 1 }]);
		const manager = new CableTrenchDataManager();

		await manager.fetchFibersForCable('cable-1');

		expect(manager.getFibersForCable('cable-1')).toEqual([{ fiber_number: 1 }]);
		expect(manager.isLoadingFibers('cable-1')).toBe(false);
		expect(manager.getFibersError('cable-1')).toBeNull();

		await manager.fetchFibersForCable('cable-1');
		expect(getFibersForCable).toHaveBeenCalledTimes(1);
	});

	test('should refetch when forced', async () => {
		getFibersForCable.mockResolvedValue([]);
		const manager = new CableTrenchDataManager();

		await manager.fetchFibersForCable('cable-1');
		await manager.fetchFibersForCable('cable-1', true);

		expect(getFibersForCable).toHaveBeenCalledTimes(2);
	});

	test('should store a per-cable error message on failure', async () => {
		getFibersForCable.mockRejectedValue(new Error('Fiber fetch failed'));
		const manager = new CableTrenchDataManager();

		await manager.fetchFibersForCable('cable-1');

		expect(manager.getFibersError('cable-1')).toBe('Failed to load fibers');
		expect(manager.getFibersForCable('cable-1')).toEqual([]);
	});
});

describe('fetchFiberColors', () => {
	test('should load fiber colors once', async () => {
		getFiberColors.mockResolvedValue([{ id: 1, fiber_color: 'rot', hex_code: '#ff0000' }]);
		const manager = new CableTrenchDataManager();

		await manager.fetchFiberColors();
		await manager.fetchFiberColors();

		expect(getFiberColors).toHaveBeenCalledTimes(1);
		expect(manager.fiberColors).toHaveLength(1);
	});
});

describe('color helpers', () => {
	async function managerWithColors(): Promise<CableTrenchDataManager> {
		getFiberColors.mockResolvedValue([
			{ id: 1, fiber_color: 'rot', hex_code: '#ff0000', name_de: 'Rot', name_en: 'Red' }
		]);
		const manager = new CableTrenchDataManager();
		await manager.fetchFiberColors();
		return manager;
	}

	test('should resolve hex codes from German names by default', async () => {
		const manager = await managerWithColors();

		expect(manager.getColorHex('rot')).toBe('#ff0000');
		expect(manager.getColorHex('Red')).toBe('#ff0000');
		expect(manager.getColorHex('unbekannt')).toBe('#808080');
		expect(manager.getColorHex('')).toBe('#808080');
	});

	test('should translate color names to the active locale', async () => {
		const manager = await managerWithColors();

		expect(manager.getColorName('red')).toBe('Rot');

		localStorage.setItem('PARAGLIDE_LOCALE', 'en');
		expect(manager.getColorName('rot')).toBe('Red');
		expect(manager.getColorName('unbekannt')).toBe('unbekannt');
	});
});

describe('reset', () => {
	test('should clear all cached state', async () => {
		getCablesInTrench.mockResolvedValue([{ uuid: 'cable-1', name: 'K' }]);
		const manager = new CableTrenchDataManager();
		await manager.fetchCablesInTrench('trench-1');

		manager.cleanup();

		expect(manager.cablesInTrench).toEqual([]);
		expect(manager.fibers).toEqual({});
		expect(manager.fiberColors).toEqual([]);
	});
});
