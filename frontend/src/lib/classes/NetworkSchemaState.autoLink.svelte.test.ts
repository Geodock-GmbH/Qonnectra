import type {
	MicroductCandidate,
	PendingMicroductChoice,
	SvelteFlowEdge
} from './NetworkSchemaState.svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { NetworkSchemaState } from './NetworkSchemaState.svelte';

// Auto-link and edge-refresh run through remote-function commands; mock the
// module so the class's calls are observable without a running server.
const autoLinkMicropipe = vi.fn();
const getMicropipeConnectionsForCable = vi.fn();

vi.mock('$lib/remote/network-schema/micropipes.remote', () => ({
	autoLinkMicropipe: (...args: unknown[]) => autoLinkMicropipe(...args),
	getMicropipeConnectionsForCable: (...args: unknown[]) => getMicropipeConnectionsForCable(...args)
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/network-schema/1') }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target: unknown, prop: string) => () => String(prop) })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn()
}));

function candidate(uuid: string): MicroductCandidate {
	return {
		microduct_uuid: uuid,
		number: 3,
		color: 'blau',
		color_hex: '#0000ff',
		conduit_uuid: 'conduit-1',
		conduit_name: 'Conduit-1',
		node_name: 'HA-Test',
		linked_cables: []
	};
}

interface AutoLinkEndResult {
	end: string;
	node_uuid: string;
	node_name: string;
	address: string | null;
	status: string;
	microduct: MicroductCandidate | null;
	candidates: MicroductCandidate[];
}

function endResult(status: string, overrides: Partial<AutoLinkEndResult> = {}): AutoLinkEndResult {
	return {
		end: 'start',
		node_uuid: 'node-1',
		node_name: 'HA-Test',
		address: 'Teststraße 1, 24941 Flensburg',
		status,
		microduct: null,
		candidates: [],
		...overrides
	};
}

describe('NetworkSchemaState auto-link', () => {
	let state: NetworkSchemaState;

	beforeEach(() => {
		state = new NetworkSchemaState();
		vi.restoreAllMocks();
		vi.clearAllMocks();
		autoLinkMicropipe.mockResolvedValue({ results: [], linked_count: 0 });
		getMicropipeConnectionsForCable.mockResolvedValue([]);
	});

	test('autoLinkMicropipe queues pending choice on multiple_candidates result', async () => {
		const candidates = [candidate('md-1'), candidate('md-2')];
		autoLinkMicropipe.mockResolvedValue({
			linked_count: 0,
			results: [endResult('multiple_candidates', { candidates })]
		});

		await state.autoLinkMicropipe('cable-1', 'Cable One');

		expect(autoLinkMicropipe).toHaveBeenCalledWith({ cableId: 'cable-1' });
		expect(state.pendingMicroductChoices).toHaveLength(1);
		expect(state.pendingMicroductChoices[0]).toMatchObject({
			cableId: 'cable-1',
			cableName: 'Cable One',
			address: 'Teststraße 1, 24941 Flensburg',
			candidates
		});
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('autoLinkMicropipe shows success toast and refreshes edge on linked result', async () => {
		state.edges = [
			{ id: 'cable-1', source: 'a', target: 'b', type: 'x', data: {} } as unknown as SvelteFlowEdge
		];
		const connections = [{ number: 3, color_hex: '#0000ff', color_name: 'blau' }];
		autoLinkMicropipe.mockResolvedValue({
			linked_count: 1,
			results: [endResult('linked', { microduct: candidate('md-1') })]
		});
		getMicropipeConnectionsForCable.mockResolvedValue(connections);

		await state.autoLinkMicropipe('cable-1', 'Cable One');

		expect(globalToaster.success).toHaveBeenCalled();
		expect(state.pendingMicroductChoices).toHaveLength(0);
		expect(getMicropipeConnectionsForCable).toHaveBeenCalledWith('cable-1');
		expect((state.edges[0].data as { micropipeConnections: unknown }).micropipeConnections).toEqual(
			connections
		);
		expect((state.edges[0].data as { isConnected: boolean }).isConnected).toBe(true);
	});

	test('autoLinkMicropipe stays silent on no_candidates and no_address', async () => {
		autoLinkMicropipe.mockResolvedValue({
			linked_count: 0,
			results: [endResult('no_candidates'), endResult('no_address', { end: 'end', address: null })]
		});

		await state.autoLinkMicropipe('cable-1', 'Cable One');

		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(globalToaster.error).not.toHaveBeenCalled();
		expect(state.pendingMicroductChoices).toHaveLength(0);
	});

	test('chooseMicroduct links the chosen microduct, shifts queue and refreshes edge', async () => {
		state.pendingMicroductChoices = [
			{
				cableId: 'cable-1',
				cableName: 'Cable One',
				end: 'start',
				nodeName: 'HA-Test',
				address: 'Teststraße 1, 24941 Flensburg',
				candidates: [candidate('md-1'), candidate('md-2')]
			} as PendingMicroductChoice
		];
		autoLinkMicropipe.mockResolvedValue({ microduct: candidate('md-2') });

		await state.chooseMicroduct('md-2');

		expect(autoLinkMicropipe).toHaveBeenCalledWith({
			cableId: 'cable-1',
			microductUuid: 'md-2'
		});
		expect(getMicropipeConnectionsForCable).toHaveBeenCalledWith('cable-1');
		expect(state.pendingMicroductChoices).toHaveLength(0);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('dismissMicroductChoice shifts queue without a link call', async () => {
		state.pendingMicroductChoices = [
			{
				cableId: 'cable-1',
				cableName: 'Cable One',
				end: 'start',
				nodeName: 'HA-Test',
				address: 'Teststraße 1, 24941 Flensburg',
				candidates: [candidate('md-1')]
			} as PendingMicroductChoice
		];

		state.dismissMicroductChoice();

		expect(state.pendingMicroductChoices).toHaveLength(0);
		expect(autoLinkMicropipe).not.toHaveBeenCalled();
	});
});
