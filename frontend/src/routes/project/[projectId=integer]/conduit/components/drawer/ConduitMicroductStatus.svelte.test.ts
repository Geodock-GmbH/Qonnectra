import type { Microduct } from '$lib/remote/conduit/microduct-data';
import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import ConduitMicroductStatus from './ConduitMicroductStatus.svelte';

const getMicroducts = vi.fn();
const updateMicroductStatus = vi.fn();

vi.mock('$lib/remote/conduit/microducts.remote', () => ({
	getMicroducts: (...args: unknown[]) => getMicroducts(...args),
	getMicroductStatusOptions: vi.fn().mockResolvedValue([{ id: 1, microduct_status: 'defekt' }]),
	updateMicroductStatus: (...args: unknown[]) => updateMicroductStatus(...args)
}));

// The table's status change callback is exercised directly through a stub
// table so the test does not depend on the combobox widget.
const onStatusChangeSpy = vi.fn();
vi.mock('$lib/components/MicroductsDisplayTable.svelte', async () => {
	const { default: Stub } = await import('./MicroductsDisplayTableStub.fixture.svelte');
	return { default: Stub };
});

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

const microducts: Microduct[] = [
	{ uuid: 'md-1', number: 1, color: 'rot', microduct_status: null },
	{
		uuid: 'md-2',
		number: 2,
		color: 'blau',
		microduct_status: { id: 1, microduct_status: 'defekt' }
	}
];

function renderStatus() {
	return render(BoundaryFixture, {
		props: { component: ConduitMicroductStatus, props: { conduitUuid: 'conduit-1' } }
	});
}

beforeEach(() => {
	getMicroducts.mockResolvedValue(microducts);
	updateMicroductStatus.mockReturnValue(commandResult({ uuid: 'md-1' }));
});

afterEach(() => {
	getMicroducts.mockReset();
	updateMicroductStatus.mockReset();
	onStatusChangeSpy.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('ConduitMicroductStatus', () => {
	test('should load the microducts and status options for the conduit', async () => {
		renderStatus();

		expect(await screen.findByTestId('microduct-md-1')).toBeInTheDocument();
		expect(screen.getByTestId('microduct-md-2')).toBeInTheDocument();
		expect(screen.getByTestId('status-option-1')).toHaveTextContent('defekt');
		expect(getMicroducts).toHaveBeenCalledWith('conduit-1');
	});

	test('should update the status through the command and toast success', async () => {
		renderStatus();
		await screen.findByTestId('microduct-md-1');

		screen.getByTestId('set-status-md-1').click();

		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
		expect(updateMicroductStatus).toHaveBeenCalledWith({
			uuid: 'md-1',
			conduitUuid: 'conduit-1',
			statusId: 1
		});
	});

	test('should toast an error when the command is rejected', async () => {
		updateMicroductStatus.mockReturnValue(commandFailure(httpError(500, 'boom')));
		renderStatus();
		await screen.findByTestId('microduct-md-1');

		screen.getByTestId('clear-status-md-2').click();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(updateMicroductStatus).toHaveBeenCalledWith({
			uuid: 'md-2',
			conduitUuid: 'conduit-1',
			statusId: null
		});
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
