import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import NodeSlotConfigPanel from './NodeSlotConfigPanel.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

// The panel talks to the container/slot-config remote module; mock it so the
// component's calls are observable without a running server.
const getContainerTypes = vi.fn();
const getContainerHierarchy = vi.fn();
const getNodeStructures = vi.fn();
const createContainer = vi.fn();
const deleteContainer = vi.fn();
const updateContainerName = vi.fn();
const moveItem = vi.fn();
const toggleContainerExpanded = vi.fn();
const createSlotConfiguration = vi.fn();
const updateSlotConfiguration = vi.fn();
const deleteSlotConfiguration = vi.fn();
const exportNodeExcel = vi.fn();

vi.mock('$lib/remote/network-schema/containers.remote', () => ({
	getContainerTypes: (...a: unknown[]) => getContainerTypes(...a),
	getContainerHierarchy: (...a: unknown[]) => remoteQueryStub(getContainerHierarchy)(...a),
	getNodeStructures: (...a: unknown[]) => remoteQueryStub(getNodeStructures)(...a),
	createContainer: (...a: unknown[]) => createContainer(...a),
	deleteContainer: (...a: unknown[]) => deleteContainer(...a),
	updateContainerName: (...a: unknown[]) => updateContainerName(...a),
	moveItem: (...a: unknown[]) => moveItem(...a),
	toggleContainerExpanded: (...a: unknown[]) => toggleContainerExpanded(...a),
	createSlotConfiguration: (...a: unknown[]) => createSlotConfiguration(...a),
	updateSlotConfiguration: (...a: unknown[]) => updateSlotConfiguration(...a),
	deleteSlotConfiguration: (...a: unknown[]) => deleteSlotConfiguration(...a),
	exportNodeExcel: (...a: unknown[]) => exportNodeExcel(...a)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: Record<string, unknown>) =>
				params ? `${prop}:${JSON.stringify(params)}` : `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

const containerTypes = [
	{ id: 1, name: 'Rack' },
	{ id: 2, name: 'Muffe' }
];

const rootSlotConfig = {
	uuid: 'cfg-1',
	side: 'A',
	total_slots: 4,
	used_slots: 1,
	free_slots: 3
};

const emptyHierarchy = { containers: [], root_slot_configurations: [] };
const defaultHierarchy = { containers: [], root_slot_configurations: [rootSlotConfig] };

/**
 * The export button carries only an icon and a tooltip (no accessible name),
 * so it is located structurally as the header's outlined button.
 */
function getExportButton(): HTMLButtonElement {
	return document.querySelector('button.preset-outlined') as HTMLButtonElement;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	getContainerTypes.mockResolvedValue(containerTypes);
	getContainerHierarchy.mockResolvedValue(defaultHierarchy);
	getNodeStructures.mockResolvedValue([]);
	createContainer.mockResolvedValue({});
	deleteContainer.mockResolvedValue(undefined);
	updateContainerName.mockResolvedValue({});
	moveItem.mockResolvedValue(undefined);
	toggleContainerExpanded.mockResolvedValue(undefined);
	createSlotConfiguration.mockResolvedValue({});
	updateSlotConfiguration.mockResolvedValue({});
	deleteSlotConfiguration.mockResolvedValue(undefined);
	exportNodeExcel.mockResolvedValue({ fileData: btoa('hello'), fileName: 'node.xlsx' });
});

afterEach(() => {
	vi.restoreAllMocks();
	[
		getContainerTypes,
		getContainerHierarchy,
		getNodeStructures,
		createContainer,
		deleteContainer,
		updateContainerName,
		moveItem,
		toggleContainerExpanded,
		createSlotConfiguration,
		updateSlotConfiguration,
		deleteSlotConfiguration,
		exportNodeExcel
	].forEach((fn) => fn.mockReset());
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('NodeSlotConfigPanel', () => {
	test('should render the node name heading when nodeName is given', async () => {
		render(NodeSlotConfigPanel, {
			nodeUuid: 'node-1',
			nodeName: 'PoP-Nord',
			onViewStructure: () => {}
		});

		expect(await screen.findByText(/PoP-Nord/)).toBeInTheDocument();
	});

	test('should show the empty state when the hierarchy has no items', async () => {
		getContainerHierarchy.mockResolvedValue(emptyHierarchy);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		expect(await screen.findByText('message_no_slot_configurations')).toBeInTheDocument();
	});

	test('should render root slot configurations from the hierarchy', async () => {
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		expect(await screen.findByText('A')).toBeInTheDocument();
		expect(getContainerHierarchy).toHaveBeenCalledWith('node-1');
	});

	test('should sync sharedSlotState with the fetched configurations', async () => {
		const sharedSlotState = { nodeUuid: null, slotConfigurations: [], lastUpdated: 0 };
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', sharedSlotState, onViewStructure: () => {} });

		await screen.findByText('A');

		await vi.waitFor(() => {
			expect(sharedSlotState.nodeUuid).toBe('node-1');
			expect(sharedSlotState.slotConfigurations).toHaveLength(1);
		});
	});

	test('should create a slot configuration from the add form and post the values', async () => {
		const user = userEvent.setup();
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		await user.click(screen.getByRole('button', { name: /action_add$/ }));

		const sideInput = screen.getByPlaceholderText('placeholder_slot_side');
		await user.type(sideInput, 'B');

		const totalInput = document.getElementById('total-slots') as HTMLInputElement;
		await user.clear(totalInput);
		await user.type(totalInput, '6');

		await user.click(screen.getByRole('button', { name: 'action_save' }));

		await vi.waitFor(() =>
			expect(createSlotConfiguration).toHaveBeenCalledWith({
				nodeUuid: 'node-1',
				side: 'B',
				totalSlots: 6
			})
		);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should toast an error when creating a slot configuration fails', async () => {
		const user = userEvent.setup();
		createSlotConfiguration.mockRejectedValue(new Error('nope'));
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		await user.click(screen.getByRole('button', { name: /action_add$/ }));
		await user.type(screen.getByPlaceholderText('placeholder_slot_side'), 'B');
		await user.click(screen.getByRole('button', { name: 'action_save' }));

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should move a dropped item to root and call moveItem', async () => {
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		const tree = screen.getByRole('tree');
		const dropEvent = new Event('drop', {
			bubbles: true,
			cancelable: true
		}) as unknown as DragEvent;
		Object.defineProperty(dropEvent, 'dataTransfer', {
			value: {
				getData: () => JSON.stringify({ type: 'slot_configuration', uuid: 'cfg-9' })
			}
		});
		tree.dispatchEvent(dropEvent);

		await vi.waitFor(() =>
			expect(moveItem).toHaveBeenCalledWith({
				itemType: 'slot_configuration',
				itemUuid: 'cfg-9',
				targetContainerId: undefined
			})
		);
	});

	test('should export Excel and download when export succeeds', async () => {
		const user = userEvent.setup();
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:mock'),
			revokeObjectURL: vi.fn()
		});

		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });
		await screen.findByText('A');

		await user.click(getExportButton());

		await vi.waitFor(() => expect(exportNodeExcel).toHaveBeenCalledWith('node-1'));
		await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());
		vi.unstubAllGlobals();
	});

	test('should confirm before deleting a slot config that has structures', async () => {
		const user = userEvent.setup();
		getNodeStructures.mockResolvedValue([{ uuid: 'st-1' }]);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		const item = screen.getByText('A').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_delete' }));

		// A confirmation MessageBox opens rather than deleting immediately.
		await vi.waitFor(() => expect(getNodeStructures).toHaveBeenCalledWith('cfg-1'));
		expect(deleteSlotConfiguration).not.toHaveBeenCalled();

		const acceptBtn = await vi.waitFor(() => {
			const btn = document.querySelector('footer button.preset-filled-error-500');
			expect(btn).toBeTruthy();
			return btn as HTMLButtonElement;
		});
		await user.click(acceptBtn);

		await vi.waitFor(() => expect(deleteSlotConfiguration).toHaveBeenCalledWith('cfg-1'));
	});

	test('should delete a slot config immediately when it has no structures', async () => {
		const user = userEvent.setup();
		getNodeStructures.mockResolvedValue([]);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		const item = screen.getByText('A').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_delete' }));

		await vi.waitFor(() => expect(deleteSlotConfiguration).toHaveBeenCalledWith('cfg-1'));
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should start editing a slot config when its edit button is clicked', async () => {
		const user = userEvent.setup();
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		const item = screen.getByText('A').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_edit' }));

		expect(screen.getByDisplayValue('A')).toBeInTheDocument();
	});

	test('should render a container from the hierarchy and delete it', async () => {
		const user = userEvent.setup();
		const container = {
			uuid: 'con-1',
			name: 'Rack-1',
			display_name: 'Rack-1',
			is_expanded: false,
			children: [],
			slot_configurations: []
		};
		getContainerHierarchy.mockResolvedValue({
			containers: [container],
			root_slot_configurations: []
		});
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		expect(await screen.findByText('Rack-1')).toBeInTheDocument();

		const item = screen.getByText('Rack-1').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_delete' }));

		await vi.waitFor(() => expect(deleteContainer).toHaveBeenCalledWith('con-1'));
	});

	test('should show the add-container form when Add Container is clicked', async () => {
		const user = userEvent.setup();
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', onViewStructure: () => {} });

		await screen.findByText('A');

		// The Add Container button only appears because container types were fetched.
		await user.click(screen.getByRole('button', { name: /action_add_container/ }));

		expect(screen.getByPlaceholderText('placeholder_container_name')).toBeInTheDocument();
		const saveBtn = screen.getByRole('button', { name: 'action_save' }) as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(true);
	});

	test('should hide add/edit controls in readonly mode', async () => {
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', readonly: true, onViewStructure: () => {} });

		await screen.findByText('A');

		expect(screen.queryByRole('button', { name: /action_add$/ })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'common_delete' })).not.toBeInTheDocument();
		expect(getExportButton()).toBeTruthy();
	});
});
