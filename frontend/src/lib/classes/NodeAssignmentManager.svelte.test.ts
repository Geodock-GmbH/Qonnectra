import type { Feature } from 'ol';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { NodeAssignmentManager } from './NodeAssignmentManager.svelte';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_info: () => 'Info',
		common_error: () => 'Fehler',
		title_success: () => 'Erfolg',
		message_info_node_has_no_address_assigned: () => 'Knoten hat keine Adresse',
		message_success_assigned_node: () => 'Knoten zugewiesen',
		message_success_unassigned_node: () => 'Knoten entfernt'
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn()
	}
}));

const fetchMock = vi.fn();

class FakeNodeLayer {}

class FakeInteractionManager {
	olMap = {
		getTargetElement: () => this.viewport
	} as never;
	viewport = { style: { cursor: '' } };
	layers: Record<string, unknown> = { nodeLayer: new FakeNodeLayer() };
	selectableLayersConfig = { trench: true, address: true, node: true };
	handleFeatureClick = vi.fn();
}

function makeFeature(id: string | undefined, properties: Record<string, unknown>): Feature {
	return {
		getId: () => id,
		getProperties: () => properties
	} as unknown as Feature;
}

function mockActionResponse(payload: unknown) {
	fetchMock.mockResolvedValue({
		text: () => Promise.resolve(JSON.stringify(payload))
	});
}

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
	vi.mocked(globalToaster.info).mockClear();
});

describe('activateAssignMode', () => {
	test('should restrict clicking to the node layer and set a crosshair cursor', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);

		manager.activateAssignMode('micro-1');

		expect(manager.isAssignMode).toBe(true);
		expect(manager.activeMicroductUuid).toBe('micro-1');
		expect(interactionManager.selectableLayersConfig).toEqual({
			trench: false,
			address: false,
			node: true
		});
		expect(interactionManager.viewport.style.cursor).toBe('crosshair');

		manager.cleanup();
	});

	test('should do nothing without a microduct uuid', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);

		manager.activateAssignMode('');

		expect(manager.isAssignMode).toBe(false);
	});

	test('should deactivate on Escape', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1');

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(manager.isAssignMode).toBe(false);
		expect(interactionManager.viewport.style.cursor).toBe('');
		expect(interactionManager.selectableLayersConfig).toEqual({
			trench: true,
			address: true,
			node: true
		});
	});
});

describe('assign mode click handler', () => {
	test('should ignore clicks on non-node layers', async () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1');

		const handler = interactionManager.handleFeatureClick as unknown as (
			feature: Feature,
			coordinate: number[],
			layer?: unknown
		) => Promise<void>;
		await handler(makeFeature('node-1', { address: 'a' }), [0, 0], {});

		expect(fetchMock).not.toHaveBeenCalled();
		manager.cleanup();
	});

	test('should toast info for nodes without an address', async () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1');

		const handler = interactionManager.handleFeatureClick as unknown as (
			feature: Feature,
			coordinate: number[],
			layer?: unknown
		) => Promise<void>;
		await handler(makeFeature('node-1', {}), [0, 0], interactionManager.layers.nodeLayer);

		expect(globalToaster.info).toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
		manager.cleanup();
	});

	test('should assign the clicked node and finish assign mode', async () => {
		mockActionResponse({ type: 'success', data: { assigned: true } });
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		const onComplete = vi.fn();
		manager.activateAssignMode('micro-1', onComplete);

		const handler = interactionManager.handleFeatureClick as unknown as (
			feature: Feature,
			coordinate: number[],
			layer?: unknown
		) => Promise<void>;
		await handler(
			makeFeature('node-1', { uuid: 'node-uuid-1', address: 'addr' }),
			[0, 0],
			interactionManager.layers.nodeLayer
		);

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(fetchMock.mock.calls[0][0]).toBe('?/assignNodeToMicroduct');
		expect(body.get('microductUuid')).toBe('micro-1');
		expect(body.get('nodeUuid')).toBe('node-uuid-1');
		expect(globalToaster.success).toHaveBeenCalled();
		expect(onComplete).toHaveBeenCalledWith({ assigned: true });
		expect(manager.isAssignMode).toBe(false);
	});

	test('should fall through to the original handler outside assign mode', async () => {
		const interactionManager = new FakeInteractionManager();
		const originalHandler = interactionManager.handleFeatureClick;
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1');
		const assignHandler = interactionManager.handleFeatureClick as unknown as (
			feature: Feature,
			coordinate: number[],
			layer?: unknown
		) => Promise<void>;
		manager.isAssignMode = false;

		const feature = makeFeature('f1', {});
		await assignHandler(feature, [1, 2], null);

		expect(originalHandler).toHaveBeenCalled();
		manager.cleanup();
	});
});

describe('assignNodeToMicroduct', () => {
	test('should toast the backend error on failure', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'Belegt' } });
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1');

		await manager.assignNodeToMicroduct('node-1');

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Belegt' })
		);
		expect(manager.isAssignMode).toBe(true);
		manager.cleanup();
	});

	test('should do nothing without an active microduct', async () => {
		const manager = new NodeAssignmentManager(new FakeInteractionManager() as never);

		await manager.assignNodeToMicroduct('node-1');

		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('removeNodeFromMicroduct', () => {
	test('should unassign the node and invoke the callback', async () => {
		mockActionResponse({ type: 'success', data: { removed: true } });
		const manager = new NodeAssignmentManager(new FakeInteractionManager() as never);
		const onComplete = vi.fn();

		await manager.removeNodeFromMicroduct('micro-1', onComplete);

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(fetchMock.mock.calls[0][0]).toBe('?/removeNodeFromMicroduct');
		expect(body.get('microductUuid')).toBe('micro-1');
		expect(globalToaster.success).toHaveBeenCalled();
		expect(onComplete).toHaveBeenCalledWith({ removed: true });
	});

	test('should toast the backend error on failure', async () => {
		mockActionResponse({ type: 'failure', data: { error: 'Nicht erlaubt' } });
		const manager = new NodeAssignmentManager(new FakeInteractionManager() as never);

		await manager.removeNodeFromMicroduct('micro-1');

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'Nicht erlaubt' })
		);
	});

	test('should do nothing without a microduct uuid', async () => {
		const manager = new NodeAssignmentManager(new FakeInteractionManager() as never);

		await manager.removeNodeFromMicroduct('');

		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('cleanup', () => {
	test('should leave assign mode when active', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1');

		manager.cleanup();

		expect(manager.isAssignMode).toBe(false);
		expect(interactionManager.viewport.style.cursor).toBe('');
	});
});
