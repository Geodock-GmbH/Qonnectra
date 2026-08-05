import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import NodeSlotConfigPanel from './NodeSlotConfigPanel.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
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

const fetchMock = vi.fn();

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

/**
 * Stub form-action responses keyed by URL. Unlisted URLs resolve to an empty
 * success payload so incidental fetches never reject.
 */
function mockRoutes(routes: Record<string, unknown> = {}) {
	fetchMock.mockImplementation((url: string) => {
		const payload = routes[url] ?? { type: 'success', data: {} };
		return Promise.resolve({
			ok: true,
			text: () => Promise.resolve(JSON.stringify(payload))
		});
	});
}

/**
 * The export button carries only an icon and a tooltip (no accessible name),
 * so it is located structurally as the header's outlined button.
 */
function getExportButton(): HTMLButtonElement {
	const btn = document.querySelector('button.preset-outlined');
	return btn as HTMLButtonElement;
}

const emptyHierarchy = { containers: [], root_slot_configurations: [] };

const defaultRoutes = {
	'?/getContainerTypes': { type: 'success', data: { containerTypes } },
	'?/getContainerHierarchy': {
		type: 'success',
		data: { hierarchy: { containers: [], root_slot_configurations: [rootSlotConfig] } }
	}
};

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

describe('NodeSlotConfigPanel', () => {
	test('should render the node name heading when nodeName is given', async () => {
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', nodeName: 'PoP-Nord' });

		// Heading combines form_node label with the node name.
		expect(await screen.findByText(/PoP-Nord/)).toBeInTheDocument();
	});

	test('should show the empty state when the hierarchy has no items', async () => {
		mockRoutes({
			...defaultRoutes,
			'?/getContainerHierarchy': { type: 'success', data: { hierarchy: emptyHierarchy } }
		});
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		expect(await screen.findByText('message_no_slot_configurations')).toBeInTheDocument();
	});

	test('should render root slot configurations from the hierarchy', async () => {
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		// The SlotConfigItem shows the config side.
		expect(await screen.findByText('A')).toBeInTheDocument();

		const getCall = fetchMock.mock.calls.find(([url]) => url === '?/getContainerHierarchy');
		expect((getCall![1].body as FormData).get('nodeUuid')).toBe('node-1');
	});

	test('should sync sharedSlotState with the fetched configurations', async () => {
		mockRoutes(defaultRoutes);
		const sharedSlotState = { nodeUuid: null, slotConfigurations: [], lastUpdated: 0 };
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', sharedSlotState });

		await screen.findByText('A');

		await vi.waitFor(() => {
			expect(sharedSlotState.nodeUuid).toBe('node-1');
			expect(sharedSlotState.slotConfigurations).toHaveLength(1);
		});
	});

	test('should create a slot configuration from the add form and post the values', async () => {
		const user = userEvent.setup();
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');
		fetchMock.mockClear();

		await user.click(screen.getByRole('button', { name: /action_add$/ }));

		const sideInput = screen.getByPlaceholderText('placeholder_slot_side');
		await user.type(sideInput, 'B');

		const totalInput = document.getElementById('total-slots') as HTMLInputElement;
		await user.clear(totalInput);
		await user.type(totalInput, '6');

		await user.click(screen.getByRole('button', { name: 'action_save' }));

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/createSlotConfiguration');
			expect(call).toBeTruthy();
			const body = call![1].body as FormData;
			expect(body.get('side')).toBe('B');
			expect(body.get('totalSlots')).toBe('6');
			expect(body.get('nodeUuid')).toBe('node-1');
		});
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should toast an error when creating a slot configuration fails', async () => {
		const user = userEvent.setup();
		mockRoutes({
			...defaultRoutes,
			'?/createSlotConfiguration': { type: 'failure', data: { error: 'nope' } }
		});
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');

		await user.click(screen.getByRole('button', { name: /action_add$/ }));
		await user.type(screen.getByPlaceholderText('placeholder_slot_side'), 'B');
		await user.click(screen.getByRole('button', { name: 'action_save' }));

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should move a dropped item to root and post to moveItem', async () => {
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');
		fetchMock.mockClear();

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

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/moveItem');
			expect(call).toBeTruthy();
			const body = call![1].body as FormData;
			expect(body.get('itemType')).toBe('slot_configuration');
			expect(body.get('itemUuid')).toBe('cfg-9');
			expect(body.get('targetContainerId')).toBe('');
		});
	});

	test('should export Excel and download when export succeeds', async () => {
		const user = userEvent.setup();
		mockRoutes({
			...defaultRoutes,
			'?/exportExcel': {
				type: 'success',
				data: { fileData: btoa('hello'), fileName: 'node.xlsx' }
			}
		});
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:mock'),
			revokeObjectURL: vi.fn()
		});

		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });
		await screen.findByText('A');

		await user.click(getExportButton());

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/exportExcel');
			expect(call).toBeTruthy();
		});
		await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());
	});

	test('should confirm before deleting a slot config that has structures', async () => {
		const user = userEvent.setup();
		mockRoutes({
			...defaultRoutes,
			'?/getNodeStructures': { type: 'success', data: { structures: [{ uuid: 'st-1' }] } }
		});
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');

		// The SlotConfigItem exposes a delete button labelled common_delete.
		const item = screen.getByText('A').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_delete' }));

		// A confirmation MessageBox opens rather than deleting immediately.
		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/getNodeStructures');
			expect(call).toBeTruthy();
		});
		expect(
			fetchMock.mock.calls.find(([url]) => url === '?/deleteSlotConfiguration')
		).toBeUndefined();

		// Accepting the dialog performs the delete. The dialog's accept button is
		// the error-preset button rendered inside the MessageBox footer.
		const acceptBtn = await vi.waitFor(() => {
			const btn = document.querySelector('footer button.preset-filled-error-500');
			expect(btn).toBeTruthy();
			return btn as HTMLButtonElement;
		});
		await user.click(acceptBtn);

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/deleteSlotConfiguration');
			expect(call).toBeTruthy();
			expect((call![1].body as FormData).get('configUuid')).toBe('cfg-1');
		});
	});

	test('should delete a slot config immediately when it has no structures', async () => {
		const user = userEvent.setup();
		mockRoutes({
			...defaultRoutes,
			'?/getNodeStructures': { type: 'success', data: { structures: [] } }
		});
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');

		const item = screen.getByText('A').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_delete' }));

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/deleteSlotConfiguration');
			expect(call).toBeTruthy();
			expect((call![1].body as FormData).get('configUuid')).toBe('cfg-1');
		});
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should start editing a slot config when its edit button is clicked', async () => {
		const user = userEvent.setup();
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');

		const item = screen.getByText('A').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_edit' }));

		// The edit form prefills the side input with the config's current side.
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
		mockRoutes({
			...defaultRoutes,
			'?/getContainerHierarchy': {
				type: 'success',
				data: { hierarchy: { containers: [container], root_slot_configurations: [] } }
			}
		});
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		expect(await screen.findByText('Rack-1')).toBeInTheDocument();

		const item = screen.getByText('Rack-1').closest('[role="treeitem"]') as HTMLElement;
		await user.click(within(item).getByRole('button', { name: 'common_delete' }));

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/deleteContainer');
			expect(call).toBeTruthy();
			expect((call![1].body as FormData).get('containerUuid')).toBe('con-1');
		});
	});

	test('should show the add-container form when Add Container is clicked', async () => {
		const user = userEvent.setup();
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1' });

		await screen.findByText('A');

		// The Add Container button only appears because container types were fetched.
		await user.click(screen.getByRole('button', { name: /action_add_container/ }));

		expect(screen.getByPlaceholderText('placeholder_container_name')).toBeInTheDocument();
		// Save is disabled until a container type is picked.
		const saveBtn = screen.getByRole('button', { name: 'action_save' }) as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(true);
	});

	test('should hide add/edit controls in readonly mode', async () => {
		mockRoutes(defaultRoutes);
		render(NodeSlotConfigPanel, { nodeUuid: 'node-1', readonly: true });

		await screen.findByText('A');

		expect(screen.queryByRole('button', { name: /action_add$/ })).not.toBeInTheDocument();
		// The SlotConfigItem hides its edit/delete buttons in readonly mode.
		expect(screen.queryByRole('button', { name: 'common_delete' })).not.toBeInTheDocument();
		// The export button remains available regardless of readonly.
		expect(getExportButton()).toBeTruthy();
	});
});
