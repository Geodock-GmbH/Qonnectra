import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import NodeStructurePanel from './NodeStructurePanel.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

// The panel drives NodeStructureManager + NodeStructureContext, which read/write
// via the node-structures and fiber-splices remote modules. Mock them observably.
const remote = {
	getSlotConfigurationsForNode: vi.fn(),
	getNodeStructures: vi.fn(),
	getSlotDividers: vi.fn(),
	getSlotClipNumbers: vi.fn(),
	deleteNodeStructure: vi.fn(),
	getFiberSplices: vi.fn()
};

vi.mock('$lib/remote/network-schema/node-structures.remote', () => ({
	getSlotConfigurationsForNode: (...a: unknown[]) =>
		remoteQueryStub(remote.getSlotConfigurationsForNode)(...a),
	getSlotDividers: (...a: unknown[]) => remoteQueryStub(remote.getSlotDividers)(...a),
	getSlotClipNumbers: (...a: unknown[]) => remoteQueryStub(remote.getSlotClipNumbers)(...a),
	createNodeStructure: vi.fn().mockResolvedValue({}),
	bulkCreateNodeStructures: vi.fn().mockResolvedValue({ created: [], failed: [] }),
	moveNodeStructure: vi.fn().mockResolvedValue({}),
	deleteNodeStructure: (...a: unknown[]) => remote.deleteNodeStructure(...a),
	createSlotDivider: vi.fn().mockResolvedValue({}),
	deleteSlotDivider: vi.fn().mockResolvedValue(undefined),
	upsertSlotClipNumber: vi.fn().mockResolvedValue({})
}));

vi.mock('$lib/remote/network-schema/containers.remote', () => ({
	getNodeStructures: (...a: unknown[]) => remoteQueryStub(remote.getNodeStructures)(...a)
}));

vi.mock('$lib/remote/network-schema/fiber-splices.remote', () => ({
	getFiberSplices: (...a: unknown[]) => remote.getFiberSplices(...a)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

// Replace heavy child components with lightweight stubs so we isolate the panel's own layout,
// combobox wiring, responsive switch, and delete-confirmation flow.
vi.mock('$lib/components/GenericCombobox.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubCombobox.svelte')).default
}));
vi.mock('$lib/components/MessageBox.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubMessageBox.svelte')).default
}));
vi.mock('./SlotGrid.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubSlotGrid.svelte')).default
}));
vi.mock('./MobileBottomSheet.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubBottomSheet.svelte')).default
}));
vi.mock('./ComponentTypeSidebar.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubPassthrough.svelte')).default
}));
vi.mock('./CableFiberSidebar.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubPassthrough.svelte')).default
}));
vi.mock('./PortTable.svelte', async () => ({
	default: (await import('./NodeStructurePanelStubPassthrough.svelte')).default
}));

const slotConfigurations = [
	{
		uuid: 'cfg-a',
		side: 'A-Side',
		total_slots: 12,
		container: { display_name: 'Rack 1 / Shelf 2' }
	},
	{ uuid: 'cfg-b', side: 'B-Side', total_slots: 24, container: null }
];

/**
 * Seeds the remote-fn mocks from the old `{ '?/action': { data } }` shape:
 * slot configs default to the fixture list; splices/structures/etc. resolve to
 * the unwrapped arrays; deleteNodeStructure resolves void.
 */
function mockRoutes(
	routes: Record<string, { type?: string; data?: Record<string, unknown> }> = {}
) {
	const dataFor = (name: string) => routes[`?/${name}`]?.data;
	remote.getSlotConfigurationsForNode.mockResolvedValue(
		(dataFor('getSlotConfigurationsForNode')?.configurations as unknown[]) ?? slotConfigurations
	);
	remote.getNodeStructures.mockResolvedValue(
		(dataFor('getNodeStructures')?.structures as unknown[]) ?? []
	);
	remote.getSlotDividers.mockResolvedValue(
		(dataFor('getSlotDividers')?.dividers as unknown[]) ?? []
	);
	remote.getSlotClipNumbers.mockResolvedValue(
		(dataFor('getSlotClipNumbers')?.clipNumbers as unknown[]) ?? []
	);
	remote.getFiberSplices.mockResolvedValue(
		(dataFor('getFiberSplices')?.splices as unknown[]) ?? []
	);
	remote.deleteNodeStructure.mockResolvedValue(undefined);
}

function setViewport(width: number) {
	Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	setViewport(1280);
	mockRoutes();
});

afterEach(() => {
	vi.restoreAllMocks();
	Object.values(remote).forEach((fn) => fn.mockReset());
});

describe('NodeStructurePanel (desktop)', () => {
	test('should fetch slot configurations for the node on mount', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		await vi.waitFor(() =>
			expect(remote.getSlotConfigurationsForNode).toHaveBeenCalledWith('node-1')
		);
	});

	test('should render the container path and total slots for the selected config', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		// First config is auto-selected -> its container path + total slots show.
		expect(await screen.findByText(/Rack 1 \/ Shelf 2/)).toBeInTheDocument();
		expect(screen.getByText(/form_total_slots/)).toHaveTextContent('12');
	});

	test('should populate the side combobox with all slot configurations', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		const combobox = (await screen.findByTestId('combobox')) as HTMLSelectElement;
		const optionLabels = Array.from(combobox.options).map((o) => o.textContent?.trim());
		expect(optionLabels).toEqual(['A-Side', 'B-Side']);
		// First config auto-selected.
		expect(combobox.value).toBe('cfg-a');
	});

	test('should switch the selected config (and its total-slots display) via the combobox', async () => {
		const user = userEvent.setup();
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		const combobox = (await screen.findByTestId('combobox')) as HTMLSelectElement;
		await user.selectOptions(combobox, 'cfg-b');

		await vi.waitFor(() => {
			expect(screen.getByText(/form_total_slots/)).toHaveTextContent('24');
		});
	});

	test('should render the SlotGrid with readonly propagated', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1', readonly: true });

		const grid = await screen.findByTestId('slot-grid');
		expect(grid).toHaveAttribute('data-readonly', 'true');
		expect(grid).toHaveAttribute('data-mobile', 'false');
	});

	test('should delete directly (no dialog) when the structure has no fiber splices', async () => {
		const user = userEvent.setup();
		mockRoutes({
			'?/getFiberSplices': { type: 'success', data: { splices: [] } },
			'?/deleteNodeStructure': { type: 'success', data: { success: true } }
		});

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		await screen.findByTestId('slot-grid');
		await user.click(screen.getByTestId('grid-delete'));

		await vi.waitFor(() => expect(remote.getFiberSplices).toHaveBeenCalled());
		// No confirmation dialog opened for a splice-free structure.
		expect(screen.queryByTestId('message-box')).not.toBeInTheDocument();
	});

	test('should open the confirmation dialog when the structure has active fiber splices', async () => {
		const user = userEvent.setup();
		mockRoutes({
			'?/getFiberSplices': {
				type: 'success',
				data: {
					splices: [
						{ port_number: 1, fiber_a_details: { uuid: 'f1' }, fiber_b_details: null },
						{ port_number: 2, fiber_a_details: null, fiber_b_details: { uuid: 'f2' } }
					]
				}
			}
		});

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		await screen.findByTestId('slot-grid');
		await user.click(screen.getByTestId('grid-delete'));

		expect(await screen.findByTestId('message-box')).toBeInTheDocument();
		// The pending splice count (2) is embedded in the dialog message.
		expect(screen.getByTestId('message-box-message').textContent).toContain('2');
	});

	test('should execute the delete when the confirmation dialog is accepted', async () => {
		const user = userEvent.setup();
		mockRoutes({
			'?/getFiberSplices': {
				type: 'success',
				data: { splices: [{ port_number: 1, fiber_a_details: { uuid: 'f1' } }] }
			},
			'?/deleteNodeStructure': { type: 'success', data: { success: true } }
		});

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		await screen.findByTestId('slot-grid');
		await user.click(screen.getByTestId('grid-delete'));

		await user.click(await screen.findByTestId('message-box-accept'));

		await vi.waitFor(() =>
			expect(remote.deleteNodeStructure).toHaveBeenCalledWith('struct-to-delete')
		);
	});
});

describe('NodeStructurePanel (mobile)', () => {
	beforeEach(() => {
		setViewport(500);
	});

	test('should render the mobile bottom nav with component/cable/port buttons', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		await screen.findByTestId('slot-grid');
		// The three bottom-nav buttons.
		expect(screen.getByRole('button', { name: 'form_components' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'form_cables' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'form_ports' })).toBeInTheDocument();
	});

	test('should pass isMobile to the SlotGrid in mobile layout', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		const grid = await screen.findByTestId('slot-grid');
		expect(grid).toHaveAttribute('data-mobile', 'true');
	});

	test('should open the components bottom sheet when the components button is tapped', async () => {
		const user = userEvent.setup();
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1' });

		await screen.findByTestId('slot-grid');
		await user.click(screen.getByText('form_components'));

		const sheet = await screen.findByTestId('bottom-sheet');
		expect(sheet.getAttribute('data-open')).toBe('components');
		expect(screen.getByTestId('bottom-sheet-title').textContent).toBe('form_component_types');
	});

	test('should hide the mobile action nav in readonly mode', async () => {
		mockRoutes();

		render(NodeStructurePanel, { nodeUuid: 'node-1', readonly: true });

		await screen.findByTestId('slot-grid');
		expect(screen.queryByText('form_components')).not.toBeInTheDocument();
	});
});
