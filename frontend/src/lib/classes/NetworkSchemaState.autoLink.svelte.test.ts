import type {
	MicroductCandidate,
	PendingMicroductChoice,
	SvelteFlowEdge
} from './NetworkSchemaState.svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { NetworkSchemaState } from './NetworkSchemaState.svelte';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
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

interface ActionResponseData {
	text: () => Promise<string>;
}

function actionResponse(data: Record<string, unknown>): ActionResponseData {
	return { text: () => Promise.resolve(JSON.stringify({ type: 'success', data })) };
}

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
	});

	test('autoLinkMicropipe queues pending choice on multiple_candidates result', async () => {
		const candidates = [candidate('md-1'), candidate('md-2')];
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			actionResponse({
				success: true,
				linked_count: 0,
				needs_choice: true,
				results: [endResult('multiple_candidates', { candidates })]
			}) as unknown as Response
		);

		await state.autoLinkMicropipe('cable-1', 'Cable One');

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
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation((url: string | URL | Request) => {
				if (String(url).includes('autoLinkMicropipe')) {
					return Promise.resolve(
						actionResponse({
							success: true,
							linked_count: 1,
							needs_choice: false,
							results: [endResult('linked', { microduct: candidate('md-1') })]
						}) as unknown as Response
					);
				}
				return Promise.resolve(actionResponse({ connections }) as unknown as Response);
			});

		await state.autoLinkMicropipe('cable-1', 'Cable One');

		expect(globalToaster.success).toHaveBeenCalled();
		expect(state.pendingMicroductChoices).toHaveLength(0);
		const refreshCall = fetchSpy.mock.calls.find((call) =>
			String(call[0]).includes('getMicropipeConnectionsForCable')
		);
		expect(refreshCall).toBeDefined();
		expect((state.edges[0].data as { micropipeConnections: unknown }).micropipeConnections).toEqual(
			connections
		);
		expect((state.edges[0].data as { isConnected: boolean }).isConnected).toBe(true);
	});

	test('autoLinkMicropipe stays silent on no_candidates and no_address', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			actionResponse({
				success: true,
				linked_count: 0,
				needs_choice: false,
				results: [
					endResult('no_candidates'),
					endResult('no_address', { end: 'end', address: null })
				]
			}) as unknown as Response
		);

		await state.autoLinkMicropipe('cable-1', 'Cable One');

		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(globalToaster.error).not.toHaveBeenCalled();
		expect(state.pendingMicroductChoices).toHaveLength(0);
	});

	test('chooseMicroduct posts microductUuid, shifts queue and refreshes edge', async () => {
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
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation((url: string | URL | Request) => {
				if (String(url).includes('autoLinkMicropipe')) {
					return Promise.resolve(
						actionResponse({
							success: true,
							status: 'linked',
							microduct: candidate('md-2')
						}) as unknown as Response
					);
				}
				return Promise.resolve(actionResponse({ connections: [] }) as unknown as Response);
			});

		await state.chooseMicroduct('md-2');

		const linkCall = fetchSpy.mock.calls.find((call) =>
			String(call[0]).includes('autoLinkMicropipe')
		);
		expect(linkCall).toBeDefined();
		const body = linkCall?.[1]?.body as FormData;
		expect(body.get('cableId')).toBe('cable-1');
		expect(body.get('microductUuid')).toBe('md-2');
		expect(state.pendingMicroductChoices).toHaveLength(0);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('dismissMicroductChoice shifts queue without POST', async () => {
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
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		state.dismissMicroductChoice();

		expect(state.pendingMicroductChoices).toHaveLength(0);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
