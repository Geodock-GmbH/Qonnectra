import type { Microduct } from '$lib/remote/conduit/microduct-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import { NodeAssignmentManager } from '../NodeAssignmentManager.svelte';
import HouseConnectionContextFixture from './HouseConnectionContext.fixture.svelte';
import HouseConnectionMicroducts from './HouseConnectionMicroducts.svelte';
import { LinkedTrenchHighlights } from '../linkedTrenchHighlights';

const getMicroducts = vi.fn();
const removeNodeFromMicroduct = vi.fn();

vi.mock('$lib/remote/conduit/microducts.remote', () => ({
	getMicroducts: (...args: unknown[]) => getMicroducts(...args)
}));

vi.mock('$lib/remote/house-connections/node-assignment.remote', () => ({
	removeNodeFromMicroduct: (...args: unknown[]) => removeNodeFromMicroduct(...args)
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

const microducts: Microduct[] = [
	{ uuid: 'md-1', number: 1, color: 'rot' },
	{
		uuid: 'md-2',
		number: 2,
		color: 'blau',
		uuid_node: {
			properties: { uuid_address: { properties: { street: 'Hauptstraße', housenumber: '5' } } }
		}
	}
];

const user = userEvent.setup();

function createNodeAssignment() {
	return new NodeAssignmentManager({
		olMap: null,
		layers: {},
		selectableLayersConfig: { trench: true, address: false, node: false },
		handleFeatureClick: vi.fn()
	});
}

function renderMicroducts(isAssignMode = false) {
	const nodeAssignment = createNodeAssignment();
	nodeAssignment.isAssignMode = isAssignMode;
	const activateAssignMode = vi.spyOn(nodeAssignment, 'activateAssignMode');
	render(HouseConnectionContextFixture, {
		props: {
			component: HouseConnectionMicroducts,
			props: { conduitUuid: 'conduit-1' },
			context: { nodeAssignment, trenchHighlights: new LinkedTrenchHighlights() }
		}
	});
	return { nodeAssignment, activateAssignMode };
}

beforeEach(() => {
	getMicroducts.mockResolvedValue(microducts);
	removeNodeFromMicroduct.mockImplementation(() => commandResult({ uuid: 'md-2' }));
});

afterEach(() => {
	getMicroducts.mockReset();
	removeNodeFromMicroduct.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('HouseConnectionMicroducts', () => {
	test('should list the microducts of the conduit', async () => {
		renderMicroducts();

		expect(await screen.findByText('rot')).toBeInTheDocument();
		expect(screen.getByText('blau')).toBeInTheDocument();
		expect(getMicroducts).toHaveBeenCalledWith('conduit-1');
	});

	test('should offer unassigning only for microducts that end at an address', async () => {
		renderMicroducts();
		await screen.findByText('rot');

		expect(
			screen.getAllByRole('button', { name: 'tooltip_assign_node_to_microduct' })
		).toHaveLength(2);
		expect(
			screen.getAllByRole('button', { name: 'tooltip_remove_node_from_microduct' })
		).toHaveLength(1);
	});

	test('should start assign mode for the microduct and its conduit', async () => {
		const { nodeAssignment, activateAssignMode } = renderMicroducts();
		const [assign] = await screen.findAllByRole('button', {
			name: 'tooltip_assign_node_to_microduct'
		});

		await user.click(assign);

		expect(activateAssignMode).toHaveBeenCalledExactlyOnceWith('md-1', 'conduit-1');
		nodeAssignment.cleanup();
	});

	test('should lock the actions once a node is being picked', async () => {
		const { nodeAssignment } = renderMicroducts();
		const [assign] = await screen.findAllByRole('button', {
			name: 'tooltip_assign_node_to_microduct'
		});

		await user.click(assign);

		for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
		nodeAssignment.cleanup();
	});

	test('should render the actions locked while a node is being picked', async () => {
		renderMicroducts(true);
		const buttons = await screen.findAllByRole('button');

		expect(buttons).toHaveLength(3);
		for (const button of buttons) expect(button).toBeDisabled();
	});

	test('should unassign the node through the command and toast success', async () => {
		renderMicroducts();
		const remove = await screen.findByRole('button', {
			name: 'tooltip_remove_node_from_microduct'
		});

		await user.click(remove);

		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalledOnce());
		expect(removeNodeFromMicroduct).toHaveBeenCalledExactlyOnceWith({
			microductUuid: 'md-2',
			conduitUuid: 'conduit-1'
		});
	});

	test('should toast the backend reason when unassigning fails', async () => {
		removeNodeFromMicroduct.mockImplementation(() =>
			commandFailure(httpError(400, 'Nicht erlaubt'))
		);
		renderMicroducts();
		const remove = await screen.findByRole('button', {
			name: 'tooltip_remove_node_from_microduct'
		});

		await user.click(remove);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Nicht erlaubt' })
			)
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should surface a failed microduct request', async () => {
		getMicroducts.mockRejectedValue(httpError(502, 'Microducts unavailable'));

		renderMicroducts();

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
