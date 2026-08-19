import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ConduitDataManager } from './ConduitDataManager.svelte';

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
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('fetchPipesInTrench', () => {
	test('should map pipes with conduit names and types to entries', async () => {
		mockActionResponse({
			type: 'success',
			data: [
				{
					uuid: 'conn-1',
					conduit: { uuid: 'pipe-1', name: 'DA 50', conduit_type: { conduit_type: 'Rohr' } }
				},
				{ uuid: 'abcdef12-3456' }
			]
		});
		const manager = new ConduitDataManager();

		await manager.fetchPipesInTrench('trench-1');

		expect(manager.pipesInTrench).toEqual([
			{
				id: 'conn-1',
				title: 'DA 50 (Rohr)',
				description: '',
				data: {
					uuid: 'conn-1',
					conduit: { uuid: 'pipe-1', name: 'DA 50', conduit_type: { conduit_type: 'Rohr' } }
				},
				pipeUuid: 'pipe-1'
			},
			{
				id: 'abcdef12-3456',
				title: 'Conduit abcdef12',
				description: '',
				data: { uuid: 'abcdef12-3456' },
				pipeUuid: ''
			}
		]);
		expect(manager.error).toBeNull();
	});

	test('should store the failure message and clear entries', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'Kein Zugriff' } });
		const manager = new ConduitDataManager();

		await manager.fetchPipesInTrench('trench-1');

		expect(manager.error).toBe('Kein Zugriff');
		expect(manager.pipesInTrench).toEqual([]);
	});

	test('should do nothing without a feature id', async () => {
		const manager = new ConduitDataManager();

		await manager.fetchPipesInTrench('');

		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('fetchMicroducts', () => {
	test('should load and cache microducts per pipe', async () => {
		mockActionResponse({ type: 'success', data: [{ uuid: 'md-1', number: 1 }] });
		const manager = new ConduitDataManager();

		await manager.fetchMicroducts('pipe-1');
		await manager.fetchMicroducts('pipe-1');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(manager.getMicroductsForPipe('pipe-1')).toEqual([{ uuid: 'md-1', number: 1 }]);
		expect(manager.isLoadingMicroducts('pipe-1')).toBe(false);
		expect(manager.getMicroductsError('pipe-1')).toBeNull();
	});

	test('should bypass the cache via refreshMicroducts', async () => {
		mockActionResponse({ type: 'success', data: [] });
		const manager = new ConduitDataManager();

		await manager.fetchMicroducts('pipe-1');
		await manager.refreshMicroducts('pipe-1');

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	test('should store a per-pipe error message on failure', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'Fehler beim Laden' } });
		const manager = new ConduitDataManager();

		await manager.fetchMicroducts('pipe-1');

		expect(manager.getMicroductsError('pipe-1')).toBe('Fehler beim Laden');
		expect(manager.getMicroductsForPipe('pipe-1')).toEqual([]);
	});
});

describe('updateMicroductInState', () => {
	test('should replace the matching microduct', async () => {
		mockActionResponse({
			type: 'success',
			data: [
				{ uuid: 'md-1', number: 1 },
				{ uuid: 'md-2', number: 2 }
			]
		});
		const manager = new ConduitDataManager();
		await manager.fetchMicroducts('pipe-1');

		manager.updateMicroductInState('pipe-1', { uuid: 'md-2', number: 2, color: 'rot' });

		expect(manager.getMicroductsForPipe('pipe-1')[1]).toEqual({
			uuid: 'md-2',
			number: 2,
			color: 'rot'
		});
	});

	test('should warn when the pipe has no loaded microducts', () => {
		const manager = new ConduitDataManager();

		manager.updateMicroductInState('pipe-x', { uuid: 'md-1' });

		expect(console.warn).toHaveBeenCalled();
	});
});

describe('fetchTrenchUuidsForConduit', () => {
	test('should fetch and cache trench uuids', async () => {
		mockActionResponse({ type: 'success', data: { trenchUuids: ['t1', 't2'] } });
		const manager = new ConduitDataManager();

		const first = await manager.fetchTrenchUuidsForConduit('conduit-1');
		const second = await manager.fetchTrenchUuidsForConduit('conduit-1');

		expect(first).toEqual(['t1', 't2']);
		expect(second).toEqual(['t1', 't2']);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(manager.getTrenchUuidsForConduit('conduit-1')).toEqual(['t1', 't2']);
	});

	test('should return an empty list on failure', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'nope' } });
		const manager = new ConduitDataManager();

		await expect(manager.fetchTrenchUuidsForConduit('conduit-1')).resolves.toEqual([]);
	});

	test('should return an empty list without a conduit uuid', async () => {
		const manager = new ConduitDataManager();

		await expect(manager.fetchTrenchUuidsForConduit('')).resolves.toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('fetchStatusOptions', () => {
	test('should load status options only once', async () => {
		mockActionResponse({ type: 'success', data: [{ id: 1, microduct_status: 'defekt' }] });
		const manager = new ConduitDataManager();

		await manager.fetchStatusOptions();
		await manager.fetchStatusOptions();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(manager.statusOptions).toEqual([{ id: 1, microduct_status: 'defekt' }]);
	});
});

describe('updateMicroductStatus', () => {
	test('should post the new status and return the updated microduct', async () => {
		mockActionResponse({
			type: 'success',
			data: { uuid: 'md-1', microduct_status: { id: 2, microduct_status: 'belegt' } }
		});
		const manager = new ConduitDataManager();

		const updated = await manager.updateMicroductStatus('md-1', 2);

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(body.get('uuid')).toBe('md-1');
		expect(body.get('microduct_status_id')).toBe('2');
		expect(updated?.microduct_status?.microduct_status).toBe('belegt');
	});

	test('should send an empty status id for healthy microducts', async () => {
		mockActionResponse({ type: 'success', data: { uuid: 'md-1' } });
		const manager = new ConduitDataManager();

		await manager.updateMicroductStatus('md-1', null);

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(body.get('microduct_status_id')).toBe('');
	});

	test('should return null when the update fails', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'nope' } });
		const manager = new ConduitDataManager();

		await expect(manager.updateMicroductStatus('md-1', 1)).resolves.toBeNull();
	});
});

describe('reset', () => {
	test('should clear all cached state', async () => {
		mockActionResponse({ type: 'success', data: { trenchUuids: ['t1'] } });
		const manager = new ConduitDataManager();
		await manager.fetchTrenchUuidsForConduit('conduit-1');

		manager.cleanup();

		expect(manager.pipesInTrench).toEqual([]);
		expect(manager.microducts).toEqual({});
		expect(manager.trenchUuidsByConduit).toEqual({});
		expect(manager.statusOptions).toEqual([]);
	});
});
