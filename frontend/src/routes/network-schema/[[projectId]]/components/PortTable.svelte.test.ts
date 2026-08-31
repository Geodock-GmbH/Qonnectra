import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import PortTableFixture from './PortTable.fixture.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

const fiberColors = [
	{ name_de: 'rot', name_en: 'red', hex_code: '#ff0000' },
	{ name_de: 'blau', name_en: 'blue', hex_code: '#0000ff' }
];

function makePortActions() {
	return {
		onDrop: vi.fn(),
		onClear: vi.fn(),
		onClose: vi.fn(),
		onToggleMergeMode: vi.fn(),
		onTogglePortSelection: vi.fn(),
		onMergePorts: vi.fn(),
		onUnmergePorts: vi.fn(),
		onMergedPortDrop: vi.fn(),
		onSetMergeSide: vi.fn()
	};
}

function makeContext(overrides: Record<string, unknown> = {}) {
	return {
		fiberColors,
		mergeSelectionMode: false,
		selectedForMerge: new Set<string>(),
		mergeSide: 'a',
		portActions: makePortActions(),
		...overrides
	};
}

function makeRow(portNumber: number, overrides: Record<string, unknown> = {}) {
	return {
		portNumber,
		hasInPort: true,
		hasOutPort: true,
		fiberA: null,
		fiberB: null,
		residentialUnitA: null,
		residentialUnitB: null,
		mergeInfoA: null,
		mergeInfoB: null,
		...overrides
	};
}

/** `context` is a reserved testing-library render option, so all props go under `props`. */
function renderPortTable(props: Record<string, unknown>) {
	return render(PortTableFixture, { props });
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PortTable', () => {
	test('should render the structure name and port count header', () => {
		renderPortTable({
			context: makeContext(),
			structureName: 'Splitter 1:8',
			portRows: [makeRow(1), makeRow(2), makeRow(3)]
		});

		expect(screen.getByRole('heading', { name: 'Splitter 1:8' })).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	test('should render the loading state', () => {
		renderPortTable({
			context: makeContext(),
			structureName: 'S1',
			portRows: [makeRow(1)],
			loading: true
		});

		expect(screen.getByText('common_loading')).toBeInTheDocument();
	});

	test('should render an empty state when there are no ports', () => {
		renderPortTable({
			context: makeContext(),
			structureName: 'S1',
			portRows: []
		});

		expect(screen.getByText('message_no_ports')).toBeInTheDocument();
	});

	test('should render port numbers and fiber content per row', () => {
		renderPortTable({
			context: makeContext(),
			structureName: 'S1',
			portRows: [
				makeRow(1, {
					fiberA: {
						uuid: 'fib-a',
						fiber_number: 12,
						bundle_number: 3,
						fiber_color: 'rot',
						cable_name: 'K-Nord',
						cable_uuid: 'cbl-1'
					}
				}),
				makeRow(2, {
					fiberB: {
						uuid: 'fib-b',
						fiber_number: 24,
						bundle_number: 5,
						fiber_color: 'blau',
						cable_name: 'K-Süd',
						cable_uuid: 'cbl-2'
					}
				})
			]
		});

		expect(screen.getByText('1')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByText('12')).toBeInTheDocument();
		expect(screen.getByText('24')).toBeInTheDocument();
		expect(screen.getByText('K-Nord')).toBeInTheDocument();
		expect(screen.getByText('K-Süd')).toBeInTheDocument();
	});

	test('should fire onClose when the close button is clicked', async () => {
		const user = userEvent.setup();
		const context = makeContext();
		renderPortTable({ context, structureName: 'S1', portRows: [makeRow(1)] });

		await user.click(screen.getByRole('button', { name: 'common_close' }));

		expect(context.portActions.onClose).toHaveBeenCalledTimes(1);
	});

	test('should enter merge mode for side A when the merge button is clicked from idle', async () => {
		const user = userEvent.setup();
		const context = makeContext();
		renderPortTable({ context, structureName: 'S1', portRows: [makeRow(1)] });

		const mergeButtons = screen.getAllByRole('button', { name: 'action_merge_ports' });
		await user.click(mergeButtons[0]);

		expect(context.portActions.onSetMergeSide).toHaveBeenCalledWith('a');
		expect(context.portActions.onToggleMergeMode).toHaveBeenCalledTimes(1);
	});

	test('should switch merge side without toggling mode when already merging on the other side', async () => {
		const user = userEvent.setup();
		const context = makeContext({ mergeSelectionMode: true, mergeSide: 'a' });
		renderPortTable({ context, structureName: 'S1', portRows: [makeRow(1)] });

		const mergeButtons = screen.getAllByRole('button', { name: 'action_merge_ports' });
		// The second merge button is the B-side toggle.
		await user.click(mergeButtons[1]);

		expect(context.portActions.onSetMergeSide).toHaveBeenCalledWith('b');
		expect(context.portActions.onToggleMergeMode).not.toHaveBeenCalled();
	});

	test('should hide merge buttons in readonly mode', () => {
		renderPortTable({
			context: makeContext(),
			structureName: 'S1',
			portRows: [makeRow(1)],
			readonly: true
		});

		expect(screen.queryByRole('button', { name: 'action_merge_ports' })).not.toBeInTheDocument();
	});

	test('should render selection checkboxes and toggle a port for merge', async () => {
		const user = userEvent.setup();
		const context = makeContext({ mergeSelectionMode: true, mergeSide: 'a' });
		renderPortTable({
			context,
			structureName: 'S1',
			portRows: [makeRow(1, { hasInPort: true }), makeRow(2, { hasInPort: true })]
		});

		// Header select-all + one checkbox per selectable row.
		const checkboxes = screen.getAllByRole('checkbox');
		expect(checkboxes.length).toBe(3);

		// The last checkbox belongs to port row 2 (per-row checkboxes follow the header).
		await user.click(checkboxes[checkboxes.length - 1]);
		expect(context.portActions.onTogglePortSelection).toHaveBeenCalledWith(2, 'a');
	});

	test('should select all selectable ports via the header checkbox', async () => {
		const user = userEvent.setup();
		const context = makeContext({ mergeSelectionMode: true, mergeSide: 'a' });
		renderPortTable({
			context,
			structureName: 'S1',
			portRows: [makeRow(1, { hasInPort: true }), makeRow(2, { hasInPort: true })]
		});

		const headerCheckbox = screen.getAllByRole('checkbox')[0];
		await user.click(headerCheckbox);

		expect(context.portActions.onTogglePortSelection).toHaveBeenCalledWith(1, 'a');
		expect(context.portActions.onTogglePortSelection).toHaveBeenCalledWith(2, 'a');
		expect(context.portActions.onTogglePortSelection).toHaveBeenCalledTimes(2);
	});

	test('should render the checkbox as checked for already selected ports', () => {
		const context = makeContext({
			mergeSelectionMode: true,
			mergeSide: 'a',
			selectedForMerge: new Set(['1-a'])
		});
		renderPortTable({
			context,
			structureName: 'S1',
			portRows: [makeRow(1, { hasInPort: true }), makeRow(2, { hasInPort: true })]
		});

		const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
		// Header select-all is unchecked (only 1 of 2 selected).
		expect(checkboxes[0].checked).toBe(false);
		// Row-1 checkbox is checked, row-2 is not.
		expect(checkboxes[1].checked).toBe(true);
		expect(checkboxes[2].checked).toBe(false);
	});

	test('should show the merge action bar and fire onMergePorts when 2+ are selected', async () => {
		const user = userEvent.setup();
		const context = makeContext({
			mergeSelectionMode: true,
			mergeSide: 'a',
			selectedForMerge: new Set(['1-a', '2-a'])
		});
		renderPortTable({
			context,
			structureName: 'S1',
			portRows: [makeRow(1, { hasInPort: true }), makeRow(2, { hasInPort: true })]
		});

		// The action-bar button's name embeds the selected count: "action_merge 2 form_ports".
		const mergeButton = screen.getByRole('button', { name: /action_merge 2 form_ports/ });
		await user.click(mergeButton);

		expect(context.portActions.onMergePorts).toHaveBeenCalledTimes(1);
	});

	test('should not show the merge action bar with fewer than 2 selected', () => {
		const context = makeContext({
			mergeSelectionMode: true,
			mergeSide: 'a',
			selectedForMerge: new Set(['1-a'])
		});
		renderPortTable({
			context,
			structureName: 'S1',
			portRows: [makeRow(1, { hasInPort: true }), makeRow(2, { hasInPort: true })]
		});

		// No standalone "Merge N Ports" action button is rendered.
		expect(screen.queryByRole('button', { name: 'action_merge' })).not.toBeInTheDocument();
	});

	test('should render a merged group cell with its port range and fire unmerge', async () => {
		const user = userEvent.setup();
		const context = makeContext();
		renderPortTable({
			context,
			structureName: 'S1',
			portRows: [
				makeRow(1, {
					mergeInfoA: {
						groupId: 'grp-1',
						isFirstInGroup: true,
						groupSize: 2,
						portRange: '1-2',
						fibers: [
							{
								uuid: 'f1',
								fiber_number: 7,
								bundle_number: 1,
								fiber_color: 'rot',
								cable_name: 'K-Merge',
								cable_uuid: 'cbl-m'
							}
						]
					}
				}),
				makeRow(2, {
					mergeInfoA: { groupId: 'grp-1', isFirstInGroup: false, groupSize: 2, portRange: '1-2' }
				})
			]
		});

		// The merged fiber content renders once (only the first row in the group).
		expect(screen.getByText('K-Merge')).toBeInTheDocument();

		const unmergeBtn = screen.getByRole('button', { name: 'action_unmerge' });
		await user.click(unmergeBtn);
		expect(context.portActions.onUnmergePorts).toHaveBeenCalledWith('grp-1');
	});
});
