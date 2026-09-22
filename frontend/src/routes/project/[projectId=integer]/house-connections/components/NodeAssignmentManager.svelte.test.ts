import Feature from 'ol/Feature.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import { NodeAssignmentManager } from './NodeAssignmentManager.svelte';

const assignNodeToMicroduct = vi.fn();

vi.mock('$lib/remote/house-connections/node-assignment.remote', () => ({
	assignNodeToMicroduct: (...args: unknown[]) => assignNodeToMicroduct(...args)
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_info: () => 'Info',
		common_error: () => 'Fehler',
		message_error_saving_data: () => 'Fehler beim Speichern',
		title_success: () => 'Erfolg',
		message_info_node_has_no_address_assigned: () => 'Knoten hat keine Adresse',
		message_success_assigned_node: () => 'Knoten zugewiesen'
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn()
	}
}));

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
	const feature = new Feature(properties);
	if (id) feature.setId(id);
	return feature;
}

beforeEach(() => {
	assignNodeToMicroduct.mockImplementation(() => commandResult({ uuid: 'micro-1' }));
});

afterEach(() => {
	assignNodeToMicroduct.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(globalToaster.info).mockClear();
});

describe('activateAssignMode', () => {
	test('should restrict clicking to the node layer and set a crosshair cursor', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);

		manager.activateAssignMode('micro-1', 'conduit-1');

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

		manager.activateAssignMode('', 'conduit-1');

		expect(manager.isAssignMode).toBe(false);
	});

	test('should do nothing without a conduit uuid', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);

		manager.activateAssignMode('micro-1', '');

		expect(manager.isAssignMode).toBe(false);
	});

	test('should deactivate on Escape', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1', 'conduit-1');

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
		manager.activateAssignMode('micro-1', 'conduit-1');

		const handler = interactionManager.handleFeatureClick as unknown as (
			feature: Feature,
			coordinate: number[],
			layer?: unknown
		) => Promise<void>;
		await handler(makeFeature('node-1', { address: 'a' }), [0, 0], {});

		expect(assignNodeToMicroduct).not.toHaveBeenCalled();
		manager.cleanup();
	});

	test('should toast info for nodes without an address', async () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1', 'conduit-1');

		const handler = interactionManager.handleFeatureClick as unknown as (
			feature: Feature,
			coordinate: number[],
			layer?: unknown
		) => Promise<void>;
		await handler(makeFeature('node-1', {}), [0, 0], interactionManager.layers.nodeLayer);

		expect(globalToaster.info).toHaveBeenCalled();
		expect(assignNodeToMicroduct).not.toHaveBeenCalled();
		manager.cleanup();
	});

	test('should assign the clicked node and finish assign mode', async () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1', 'conduit-1');

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

		expect(assignNodeToMicroduct).toHaveBeenCalledExactlyOnceWith({
			microductUuid: 'micro-1',
			conduitUuid: 'conduit-1',
			nodeUuid: 'node-uuid-1'
		});
		expect(globalToaster.success).toHaveBeenCalled();
		expect(manager.isAssignMode).toBe(false);
		expect(manager.activeMicroductUuid).toBeNull();
	});

	test('should fall through to the original handler outside assign mode', async () => {
		const interactionManager = new FakeInteractionManager();
		const originalHandler = interactionManager.handleFeatureClick;
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1', 'conduit-1');
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
		assignNodeToMicroduct.mockImplementation(() => commandFailure(httpError(400, 'Belegt')));
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1', 'conduit-1');

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

		expect(assignNodeToMicroduct).not.toHaveBeenCalled();
	});
});

describe('cleanup', () => {
	test('should leave assign mode when active', () => {
		const interactionManager = new FakeInteractionManager();
		const manager = new NodeAssignmentManager(interactionManager as never);
		manager.activateAssignMode('micro-1', 'conduit-1');

		manager.cleanup();

		expect(manager.isAssignMode).toBe(false);
		expect(interactionManager.viewport.style.cursor).toBe('');
	});
});
