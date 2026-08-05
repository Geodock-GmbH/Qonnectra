import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { CablePathManager } from './CablePathManager.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		title_success: () => 'Erfolg',
		common_error: () => 'Fehler',
		message_success_updating_cable_path: () => 'Kabelpfad aktualisiert',
		message_error_updating_cable_path: () => 'Kabelpfad konnte nicht aktualisiert werden'
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

const fetchMock = vi.fn();
const waypoints = [
	{ x: 1, y: 2 },
	{ x: 3, y: 4 }
];

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('updatePath', () => {
	test('should update the edge state without saving for temporary updates', async () => {
		const updateCallback = vi.fn();
		const manager = new CablePathManager();

		await manager.updatePath('edge-1', waypoints, true, false, updateCallback);

		expect(updateCallback).toHaveBeenCalledWith('edge-1', {
			data: { cable: { diagram_path: waypoints } }
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should save the path to the backend and toast success', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ type: 'success' })
		});
		const updateCallback = vi.fn();
		const manager = new CablePathManager();

		await manager.updatePath('edge-1', waypoints, false, true, updateCallback);

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('?/saveCableGeometry');
		expect(options.method).toBe('POST');
		expect(options.body.get('cableId')).toBe('edge-1');
		expect(options.body.get('diagram_path')).toBe(JSON.stringify(waypoints));
		expect(globalToaster.success).toHaveBeenCalled();
		expect(globalToaster.error).not.toHaveBeenCalled();
	});

	test('should toast an error when the backend rejects the save', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			json: () => Promise.resolve({ type: 'error', message: 'nope' })
		});
		const manager = new CablePathManager();

		await manager.updatePath('edge-1', waypoints, false, true, vi.fn());

		expect(globalToaster.error).toHaveBeenCalled();
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should toast an error on network failures', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const manager = new CablePathManager();

		await manager.updatePath('edge-1', waypoints, false, true, vi.fn());

		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('updateHandles', () => {
	test('should forward the handle configuration to the callback', () => {
		const updateCallback = vi.fn();
		const manager = new CablePathManager();

		manager.updateHandles('cable-1', 'top', 'bottom', updateCallback);

		expect(updateCallback).toHaveBeenCalledWith('cable-1', 'top', 'bottom');
	});
});
