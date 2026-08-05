import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CableTrenchDataManager } from './CableTrenchDataManager.svelte';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

const fetchMock = vi.fn();

function mockActionResponse(payload: unknown) {
	fetchMock.mockResolvedValue({
		text: () => Promise.resolve(JSON.stringify(payload))
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('fetchCablesInTrench', () => {
	test('should map cables to display items with type in the title', async () => {
		mockActionResponse({
			type: 'success',
			data: [
				{
					uuid: 'cable-1',
					name: 'K-Nord',
					cable_type: { cable_type: 'LWL 96' },
					fiber_count: 96
				},
				{ uuid: 'abcdef12-3456', name: null }
			]
		});
		const manager = new CableTrenchDataManager();

		await manager.fetchCablesInTrench('trench-1');

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

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should store the failure error message', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'No access' } });
		const manager = new CableTrenchDataManager();

		await manager.fetchCablesInTrench('trench-1');

		expect(manager.error).toBe('No access');
		expect(manager.cablesInTrench).toEqual([]);
	});

	test('should store a generic message on network errors', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const manager = new CableTrenchDataManager();

		await manager.fetchCablesInTrench('trench-1');

		expect(manager.error).toBe('Failed to load cables');
		expect(manager.loading).toBe(false);
	});
});

describe('fetchFibersForCable', () => {
	test('should load and cache fibers per cable', async () => {
		mockActionResponse({ type: 'success', data: { fibers: [{ fiber_number: 1 }] } });
		const manager = new CableTrenchDataManager();

		await manager.fetchFibersForCable('cable-1');

		expect(manager.getFibersForCable('cable-1')).toEqual([{ fiber_number: 1 }]);
		expect(manager.isLoadingFibers('cable-1')).toBe(false);
		expect(manager.getFibersError('cable-1')).toBeNull();

		await manager.fetchFibersForCable('cable-1');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test('should refetch when forced', async () => {
		mockActionResponse({ type: 'success', data: { fibers: [] } });
		const manager = new CableTrenchDataManager();

		await manager.fetchFibersForCable('cable-1');
		await manager.fetchFibersForCable('cable-1', true);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	test('should store per-cable error messages on failure', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'Fiber fetch failed' } });
		const manager = new CableTrenchDataManager();

		await manager.fetchFibersForCable('cable-1');

		expect(manager.getFibersError('cable-1')).toBe('Fiber fetch failed');
		expect(manager.getFibersForCable('cable-1')).toEqual([]);
	});
});

describe('fetchFiberColors', () => {
	test('should load fiber colors once', async () => {
		mockActionResponse({
			type: 'success',
			data: { fiberColors: [{ id: 1, fiber_color: 'rot', hex_code: '#ff0000' }] }
		});
		const manager = new CableTrenchDataManager();

		await manager.fetchFiberColors();
		await manager.fetchFiberColors();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(manager.fiberColors).toHaveLength(1);
	});
});

describe('color helpers', () => {
	async function managerWithColors(): Promise<CableTrenchDataManager> {
		mockActionResponse({
			type: 'success',
			data: {
				fiberColors: [
					{ id: 1, fiber_color: 'rot', hex_code: '#ff0000', name_de: 'Rot', name_en: 'Red' }
				]
			}
		});
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
		mockActionResponse({ type: 'success', data: [{ uuid: 'cable-1', name: 'K' }] });
		const manager = new CableTrenchDataManager();
		await manager.fetchCablesInTrench('trench-1');

		manager.cleanup();

		expect(manager.cablesInTrench).toEqual([]);
		expect(manager.fibers).toEqual({});
		expect(manager.fiberColors).toEqual([]);
	});
});
