import type { DragDropManager } from '$lib/classes/DragDropManager.svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import Fixture from './CableFiberSidebar.fixture.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

// CableFiberDataManager reads through fibers.remote; mock it so the sidebar's
// data is observable without a running server.
const getCablesAtNode = vi.fn();
const getFibersForCable = vi.fn();
const getFiberColors = vi.fn();
const getFiberUsageInNode = vi.fn();
const getAddressesForNode = vi.fn();
const getUsedResidentialUnits = vi.fn();

vi.mock('$lib/remote/network-schema/fibers.remote', () => ({
	getCablesAtNode: (...a: unknown[]) => remoteQueryStub(getCablesAtNode)(...a),
	getFibersForCable: (...a: unknown[]) => getFibersForCable(...a),
	getFiberColors: (...a: unknown[]) => getFiberColors(...a),
	getFiberUsageInNode: (...a: unknown[]) => remoteQueryStub(getFiberUsageInNode)(...a),
	getAddressesForNode: (...a: unknown[]) => getAddressesForNode(...a),
	getUsedResidentialUnits: (...a: unknown[]) => remoteQueryStub(getUsedResidentialUnits)(...a),
	getFiberStatusOptions: vi.fn().mockResolvedValue([]),
	updateFiberStatus: vi.fn().mockResolvedValue(null)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const cables = [
	{ uuid: 'cab-1', name: 'K-Nord', direction: 'start', fiber_count: 12 },
	{ uuid: 'cab-2', name: 'K-Süd', direction: 'end', fiber_count: 24 }
];

const fibers = [
	{
		uuid: 'fib-1',
		bundle_number: 1,
		bundle_color: 'Rot',
		fiber_number_absolute: 1,
		fiber_color: 'Blau',
		fiber_status: null
	},
	{
		uuid: 'fib-2',
		bundle_number: 1,
		bundle_color: 'Rot',
		fiber_number_absolute: 2,
		fiber_color: 'Gelb',
		fiber_status: null
	}
];

const addresses = [
	{
		uuid: 'addr-1',
		street: 'Hauptstraße',
		housenumber: 5,
		residential_units: [{ uuid: 'ru-1', id_residential_unit: 'WE-1' }]
	}
];

const fiberColors = [
	{ name_de: 'Blau', name_en: 'Blue', hex_code: '#0000ff' },
	{ name_de: 'Gelb', name_en: 'Yellow', hex_code: '#ffff00' },
	{ name_de: 'Rot', name_en: 'Red', hex_code: '#ff0000' }
];

/**
 * Seed the fibers.remote mocks with the default happy-path data.
 */
function seedDefaults() {
	getCablesAtNode.mockResolvedValue(cables);
	getFibersForCable.mockResolvedValue(fibers);
	getFiberColors.mockResolvedValue(fiberColors);
	getAddressesForNode.mockResolvedValue(addresses);
	getFiberUsageInNode.mockResolvedValue({ usedFiberUuids: [], fiberComponentMap: {} });
	getUsedResidentialUnits.mockResolvedValue({
		usedResidentialUnitUuids: [],
		residentialUnitComponentMap: {}
	});
}

/**
 * Build a minimal drag-drop manager stub exposing every method the sidebar calls.
 */
function makeDragDropManager() {
	return {
		startCableDrag: vi.fn(),
		startBundleDrag: vi.fn(),
		startFiberDrag: vi.fn(),
		startAddressDrag: vi.fn(),
		startResidentialUnitDrag: vi.fn(),
		endDrag: vi.fn(),
		selectMobileFiber: vi.fn(),
		selectMobileResidentialUnit: vi.fn()
	};
}

/**
 * Dispatch a dragstart event carrying a stubbed dataTransfer on the element.
 */
function fireDragStart(el: HTMLElement) {
	const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
	const event = new Event('dragstart', { bubbles: true }) as unknown as DragEvent;
	Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
	el.dispatchEvent(event);
	return dataTransfer;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	seedDefaults();
});

afterEach(() => {
	vi.restoreAllMocks();
	[
		getCablesAtNode,
		getFibersForCable,
		getFiberColors,
		getFiberUsageInNode,
		getAddressesForNode,
		getUsedResidentialUnits
	].forEach((fn) => fn.mockReset());
});

describe('CableFiberSidebar (desktop)', () => {
	test('should fetch and render cables with fiber counts', async () => {
		render(Fixture, { nodeUuid: 'node-1' });

		expect(await screen.findByText('K-Nord')).toBeInTheDocument();
		expect(screen.getByText('K-Süd')).toBeInTheDocument();

		expect(getCablesAtNode).toHaveBeenCalledWith('node-1');
	});

	test('should show the empty message when there are no cables or addresses', async () => {
		getCablesAtNode.mockResolvedValue([]);
		getAddressesForNode.mockResolvedValue([]);
		render(Fixture, { nodeUuid: 'node-1' });

		// Desktop empty state still lists the cables header plus the empty note.
		expect(await screen.findByText('message_no_cables')).toBeInTheDocument();
	});

	test('should expand a cable and fetch its fibers grouped into bundles', async () => {
		const user = userEvent.setup();
		render(Fixture, { nodeUuid: 'node-1' });

		await screen.findByText('K-Nord');
		getFibersForCable.mockClear();

		// The first cable row (role="button") holds the chevron toggle button.
		const cableRow = screen.getAllByText('K-Nord')[0].closest('[role="button"]') as HTMLElement;
		const toggle = cableRow.querySelector('button') as HTMLButtonElement;
		await user.click(toggle);

		await vi.waitFor(() => expect(getFibersForCable).toHaveBeenCalledWith('cab-1'));

		// A single bundle (bundle 1) groups both fibers; label reads "form_bundle 1".
		expect(await screen.findByText('form_bundle 1')).toBeInTheDocument();
	});

	test('should render addresses section with residential unit counts', async () => {
		render(Fixture, { nodeUuid: 'node-1' });

		expect(await screen.findByText('Hauptstraße 5')).toBeInTheDocument();
	});

	test('should start a cable drag through the drag-drop manager', async () => {
		const dragDropManager = makeDragDropManager();
		render(Fixture, {
			nodeUuid: 'node-1',
			dragDropManager: dragDropManager as unknown as DragDropManager
		});

		await screen.findByText('K-Nord');

		const cableRow = screen.getByText('K-Nord').closest('[role="button"]') as HTMLElement;
		fireDragStart(cableRow);

		expect(dragDropManager.startCableDrag).toHaveBeenCalled();
		expect(dragDropManager.startCableDrag.mock.calls[0][1]).toMatchObject({ uuid: 'cab-1' });
	});

	test('should NOT start a drag when readonly', async () => {
		const dragDropManager = makeDragDropManager();
		render(Fixture, {
			nodeUuid: 'node-1',
			dragDropManager: dragDropManager as unknown as DragDropManager,
			readonly: true
		});

		await screen.findByText('K-Nord');

		const cableRow = screen.getByText('K-Nord').closest('[role="button"]') as HTMLElement;
		fireDragStart(cableRow);

		expect(dragDropManager.startCableDrag).not.toHaveBeenCalled();
	});

	test('should collapse and re-expand the panel', async () => {
		const user = userEvent.setup();
		render(Fixture, { nodeUuid: 'node-1' });

		await screen.findByText('K-Nord');

		await user.click(screen.getByRole('button', { name: 'action_collapse' }));
		expect(screen.queryByText('K-Nord')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'action_expand' }));
		expect(await screen.findByText('K-Nord')).toBeInTheDocument();
	});
});

describe('CableFiberSidebar (mobile)', () => {
	test('should render cables and select a fiber on tap', async () => {
		const user = userEvent.setup();
		const dragDropManager = makeDragDropManager();
		render(Fixture, {
			nodeUuid: 'node-1',
			isMobile: true,
			dragDropManager: dragDropManager as unknown as DragDropManager
		});

		// Expand cable, then bundle, then tap a fiber.
		await user.click(await screen.findByText('K-Nord'));
		await user.click(await screen.findByText('form_bundle 1'));

		const fiberBtn = await screen.findByText('1');
		await user.click(fiberBtn);

		expect(dragDropManager.selectMobileFiber).toHaveBeenCalled();
	});

	test('should not select a fiber on tap when readonly', async () => {
		const user = userEvent.setup();
		const dragDropManager = makeDragDropManager();
		render(Fixture, {
			nodeUuid: 'node-1',
			isMobile: true,
			readonly: true,
			dragDropManager: dragDropManager as unknown as DragDropManager
		});

		await user.click(await screen.findByText('K-Nord'));
		await user.click(await screen.findByText('form_bundle 1'));
		await user.click(await screen.findByText('1'));

		expect(dragDropManager.selectMobileFiber).not.toHaveBeenCalled();
	});
});
