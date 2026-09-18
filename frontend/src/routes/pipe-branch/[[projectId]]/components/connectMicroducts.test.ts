import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
import type { OverrideStub } from '$lib/test-utils/remote-stubs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import {
	commandFailure,
	commandResult,
	httpError,
	queryResult
} from '$lib/test-utils/remote-stubs';

import { connectMicroducts } from './connectMicroducts';

const getConnections = vi.fn();
const createConnections = vi.fn();

vi.mock('$lib/remote/pipe-branch/connections.remote', () => ({
	getConnections: (...args: unknown[]) => getConnections(...args),
	createConnections: (...args: unknown[]) => createConnections(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const pairA = {
	from: { microductUuid: 'm1', trenchUuid: 't1' },
	to: { microductUuid: 'm3', trenchUuid: 't2' }
};
const pairB = {
	from: { microductUuid: 'm2', trenchUuid: 't1' },
	to: { microductUuid: 'm4', trenchUuid: 't2' }
};

beforeEach(() => {
	getConnections.mockReturnValue(queryResult<BranchConnection[]>([]));
	createConnections.mockReturnValue(commandResult({ created: 1, errors: [] }));
});

afterEach(() => {
	getConnections.mockReset();
	createConnections.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(logToBackendClient).mockClear();
});

describe('connectMicroducts', () => {
	test('should create the connection at the node and report success', async () => {
		await connectMicroducts('node-1', [pairA]);

		expect(createConnections).toHaveBeenCalledExactlyOnceWith({
			nodeUuid: 'node-1',
			pairs: [pairA]
		});
		expect(globalToaster.success).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'message_success_creating_connection' })
		);
		expect(globalToaster.error).not.toHaveBeenCalled();
	});

	test('should show the pairs as pending connections of the node while saving', async () => {
		const existing: BranchConnection = { uuid: 'conn-1', ...pairB };
		const updates: unknown[] = [];
		getConnections.mockReturnValue(queryResult<BranchConnection[]>([existing]));
		createConnections.mockReturnValue(
			commandResult({ created: 1, errors: [] }, (...handed) => updates.push(...handed))
		);

		await connectMicroducts('node-1', [pairA]);

		expect(getConnections).toHaveBeenCalledWith('node-1');
		const [override] = updates as Array<OverrideStub<BranchConnection[]>>;
		expect(override.update([existing])).toEqual([existing, { uuid: null, ...pairA }]);
	});

	test('should show the reason the backend rejected a single connection', async () => {
		createConnections.mockReturnValue(
			commandResult({ created: 0, errors: ['Microduct already connected.'] })
		);

		await connectMicroducts('node-1', [pairA]);

		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'Microduct already connected.' })
		);
	});

	test('should fall back to a generic message when the backend gave no reason', async () => {
		createConnections.mockReturnValue(commandResult({ created: 0, errors: [null] }));

		await connectMicroducts('node-1', [pairA]);

		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'message_error_creating_connection' })
		);
	});

	test('should count created and failed connections of a batch', async () => {
		createConnections.mockReturnValue(
			commandResult({ created: 1, errors: ['Already connected.'] })
		);

		await connectMicroducts('node-1', [pairA, pairB]);

		expect(globalToaster.success).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: '1x message_created_connections' })
		);
		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: '1x message_failed_to_create_connections' })
		);
	});

	test('should report and log a failed request', async () => {
		createConnections.mockReturnValue(commandFailure(httpError(502, 'Backend unavailable')));

		await connectMicroducts('node-1', [pairA]);

		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'Backend unavailable' })
		);
		expect(logToBackendClient).toHaveBeenCalledOnce();
	});
});
