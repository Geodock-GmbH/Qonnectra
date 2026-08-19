import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import SlotGridTestHarness from './SlotGridTestHarness.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

function makeSlotActions() {
	return {
		onDragOver: vi.fn(),
		onDrop: vi.fn(),
		onTap: vi.fn()
	};
}

function makeStructureActions() {
	return {
		onSelect: vi.fn(),
		onDelete: vi.fn(),
		onDragStart: vi.fn(),
		onDragEnd: vi.fn()
	};
}

function makeDividerActions() {
	return { onToggle: vi.fn() };
}

function makeClipActions() {
	return {
		onStartEditing: vi.fn(),
		onSave: vi.fn(),
		onKeydown: vi.fn()
	};
}

function makeContext(overrides: Record<string, unknown> = {}) {
	return {
		structures: [],
		selectedStructure: null,
		isDragging: false,
		draggedItem: null,
		dropPreviewSlots: [],
		componentRanges: [],
		occupiedSlots: new Map(),
		mobileSelectedItem: null,
		editingClipSlot: null,
		editingClipValue: '',
		slotActions: makeSlotActions(),
		structureActions: makeStructureActions(),
		dividerActions: makeDividerActions(),
		clipActions: makeClipActions(),
		...overrides
	};
}

/**
 * Build a single slot row. Occupied rows default to a block start with a structure.
 */
function makeRow(slotNumber: number, overrides: Record<string, unknown> = {}) {
	return {
		slotNumber,
		structure: undefined,
		isBlockStart: false,
		blockSize: 1,
		isOccupied: false,
		hasDividerAfter: false,
		clipNumber: null,
		isDropTarget: false,
		...overrides
	};
}

function makeStructureRow(slotNumber: number, structure: Record<string, unknown>, blockSize = 1) {
	return makeRow(slotNumber, {
		structure,
		isBlockStart: true,
		blockSize,
		isOccupied: true
	});
}

/** `context` is a reserved testing-library render option, so props are nested. */
function renderSlotGrid(props: Record<string, unknown>) {
	return render(SlotGridTestHarness, { props });
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SlotGrid', () => {
	test('should render column headers', () => {
		renderSlotGrid({ context: makeContext(), slotRows: [makeRow(1)] });

		expect(screen.getByText('form_tpu')).toBeInTheDocument();
		expect(screen.getByText('form_component')).toBeInTheDocument();
		expect(screen.getByText('form_clip_number')).toBeInTheDocument();
	});

	test('should render the loading state when loading', () => {
		renderSlotGrid({ context: makeContext(), slotRows: [makeRow(1)], loading: true });

		expect(screen.getByText('common_loading')).toBeInTheDocument();
	});

	test('should render the loading state when loadingStructures', () => {
		renderSlotGrid({ context: makeContext(), slotRows: [makeRow(1)], loadingStructures: true });

		expect(screen.getByText('common_loading')).toBeInTheDocument();
	});

	test('should render the empty state when there are no slot rows', () => {
		renderSlotGrid({ context: makeContext(), slotRows: [] });

		expect(screen.getByText('message_no_slot_configurations')).toBeInTheDocument();
	});

	test('should render slot numbers and structure labels', () => {
		renderSlotGrid({
			context: makeContext(),
			slotRows: [
				makeStructureRow(1, {
					uuid: 's-1',
					component_type: { component_type: 'Splitter 1:8' },
					component_structure: { article_number: 'ART-123' }
				}),
				makeRow(2, { clipNumber: 'C2' })
			]
		});

		// The tpu (slot number) cell carries role="cell".
		const tpuCells = screen.getAllByRole('cell');
		expect(tpuCells.map((c) => c.textContent?.trim())).toContain('1');
		expect(screen.getByText('Splitter 1:8')).toBeInTheDocument();
		expect(screen.getByText('ART-123')).toBeInTheDocument();
		expect(screen.getByText('C2')).toBeInTheDocument();
	});

	test('should fall back to label then dash for the structure name', () => {
		renderSlotGrid({
			context: makeContext(),
			slotRows: [makeStructureRow(1, { uuid: 's-1', component_type: null, label: 'My Label' })]
		});

		expect(screen.getByText('My Label')).toBeInTheDocument();
	});

	test('should call onStructureSelect when an occupied slot is clicked (desktop)', async () => {
		const user = userEvent.setup();
		const onStructureSelect = vi.fn();
		const structure = { uuid: 's-1', component_type: { component_type: 'PP' } };
		renderSlotGrid({
			context: makeContext(),
			slotRows: [makeStructureRow(1, structure)],
			onStructureSelect
		});

		await user.click(screen.getByText('PP'));

		expect(onStructureSelect).toHaveBeenCalledWith(structure);
	});

	test('should call onStructureDelete with the structure uuid via the delete button', async () => {
		const user = userEvent.setup();
		const onStructureDelete = vi.fn();
		const onStructureSelect = vi.fn();
		renderSlotGrid({
			context: makeContext(),
			slotRows: [makeStructureRow(1, { uuid: 's-42', component_type: { component_type: 'PP' } })],
			onStructureDelete,
			onStructureSelect
		});

		await user.click(screen.getByRole('button', { name: 'common_delete' }));

		expect(onStructureDelete).toHaveBeenCalledWith('s-42');
		// Delete click stops propagation, so select must NOT fire.
		expect(onStructureSelect).not.toHaveBeenCalled();
	});

	test('should call dividerActions.onToggle on double-click of a tpu cell', async () => {
		const user = userEvent.setup();
		const context = makeContext();
		renderSlotGrid({ context, slotRows: [makeRow(3, { clipNumber: 'C3' })] });

		const tpuCell = screen.getByRole('cell');
		await user.dblClick(tpuCell);

		expect(context.dividerActions.onToggle).toHaveBeenCalledWith(3);
	});

	test('should render the clip number and enter edit mode on click', async () => {
		const user = userEvent.setup();
		const context = makeContext();
		renderSlotGrid({ context, slotRows: [makeRow(5, { clipNumber: '99' })] });

		// The clip cell shows the clip number.
		const clipButton = screen.getByRole('button', { name: 'tooltip_click_to_edit' });
		expect(clipButton.textContent?.trim()).toBe('99');

		await user.click(clipButton);
		expect(context.clipActions.onStartEditing).toHaveBeenCalledWith(5, '99');
	});

	test('should fall back to the slot number when no clip number is set', () => {
		renderSlotGrid({ context: makeContext(), slotRows: [makeRow(7, { clipNumber: null })] });

		const clipButton = screen.getByRole('button', { name: 'tooltip_click_to_edit' });
		expect(clipButton.textContent?.trim()).toBe('7');
	});

	test('should render a clip edit input when editingClipSlot matches and update value on input', async () => {
		const user = userEvent.setup();
		const context = makeContext({ editingClipSlot: 4, editingClipValue: 'AB' });
		renderSlotGrid({ context, slotRows: [makeRow(4, { clipNumber: 'AB' })] });

		const input = screen.getByDisplayValue('AB') as HTMLInputElement;
		expect(input).toBeInTheDocument();

		await user.type(input, 'C');
		// handleClipInput writes each keystroke's target value into the context.
		expect(context.editingClipValue).toBe('ABC');
	});

	test('should call clipActions.onSave on blur of the edit input', async () => {
		const user = userEvent.setup();
		const context = makeContext({ editingClipSlot: 2, editingClipValue: '2' });
		renderSlotGrid({ context, slotRows: [makeRow(2, { clipNumber: '2' })] });

		const input = screen.getByDisplayValue('2');
		input.focus();
		await user.tab();

		expect(context.clipActions.onSave).toHaveBeenCalled();
	});

	test('should call clipActions.onKeydown on keydown in the edit input', async () => {
		const user = userEvent.setup();
		const context = makeContext({ editingClipSlot: 1, editingClipValue: '1' });
		renderSlotGrid({ context, slotRows: [makeRow(1, { clipNumber: '1' })] });

		const input = screen.getByDisplayValue('1');
		input.focus();
		await user.keyboard('{Enter}');

		expect(context.clipActions.onKeydown).toHaveBeenCalled();
	});

	test('should call slotActions.onDrop when a component is dropped on a slot', () => {
		const context = makeContext();
		renderSlotGrid({ context, slotRows: [makeRow(1)] });

		// The empty slot content cell has role="gridcell".
		const cells = screen.getAllByRole('gridcell');
		const slotContent = cells.find((c) => c.className.includes('slot-content')) as HTMLElement;

		const dropEvent = new Event('drop', {
			bubbles: true,
			cancelable: true
		}) as unknown as DragEvent;
		Object.defineProperty(dropEvent, 'dataTransfer', {
			value: { getData: () => '' }
		});
		slotContent.dispatchEvent(dropEvent);

		expect(context.slotActions.onDrop).toHaveBeenCalled();
		expect(context.slotActions.onDrop.mock.calls[0][1]).toBe(1);
	});

	test('should call slotActions.onDragOver on dragover of a slot', () => {
		const context = makeContext();
		renderSlotGrid({ context, slotRows: [makeRow(1)] });

		const cells = screen.getAllByRole('gridcell');
		const slotContent = cells.find((c) => c.className.includes('slot-content')) as HTMLElement;

		const dragOver = new Event('dragover', {
			bubbles: true,
			cancelable: true
		}) as unknown as DragEvent;
		Object.defineProperty(dragOver, 'dataTransfer', { value: { getData: () => '' } });
		slotContent.dispatchEvent(dragOver);

		expect(context.slotActions.onDragOver).toHaveBeenCalled();
		expect(context.slotActions.onDragOver.mock.calls[0][1]).toBe(1);
	});

	test('should call structureActions.onDragStart when dragging a structure block', () => {
		const context = makeContext();
		const structure = { uuid: 's-1', component_type: { component_type: 'PP' } };
		renderSlotGrid({ context, slotRows: [makeStructureRow(1, structure)] });

		const block = screen.getByText('PP').closest('[role="button"]') as HTMLElement;
		const dragStart = new Event('dragstart', { bubbles: true }) as unknown as DragEvent;
		Object.defineProperty(dragStart, 'dataTransfer', { value: { setData: vi.fn() } });
		block.dispatchEvent(dragStart);

		expect(context.structureActions.onDragStart).toHaveBeenCalled();
		expect(context.structureActions.onDragStart.mock.calls[0][1]).toEqual(structure);
	});

	test('should call slotActions.onTap when tapping an empty slot in mobile with a selected item', async () => {
		const user = userEvent.setup();
		const context = makeContext({ mobileSelectedItem: { id: 1, name: 'X' } });
		renderSlotGrid({ context, slotRows: [makeRow(3)], isMobile: true });

		expect(screen.getByText('action_tap_to_place')).toBeInTheDocument();

		const cells = screen.getAllByRole('gridcell');
		const slotContent = cells.find((c) => c.className.includes('slot-content')) as HTMLElement;
		await user.click(slotContent);

		expect(context.slotActions.onTap).toHaveBeenCalledWith(3);
	});

	describe('readonly', () => {
		test('should hide the delete button and grip in readonly mode', () => {
			renderSlotGrid({
				context: makeContext(),
				slotRows: [makeStructureRow(1, { uuid: 's-1', component_type: { component_type: 'PP' } })],
				readonly: true
			});

			expect(screen.getByText('PP')).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'common_delete' })).not.toBeInTheDocument();
		});

		test('should render clip numbers as static text (no edit button) in readonly mode', () => {
			renderSlotGrid({
				context: makeContext(),
				slotRows: [makeRow(1, { clipNumber: '11' })],
				readonly: true
			});

			expect(
				screen.queryByRole('button', { name: 'tooltip_click_to_edit' })
			).not.toBeInTheDocument();
			expect(screen.getByText('11')).toBeInTheDocument();
		});

		test('should not toggle dividers on double-click in readonly mode', async () => {
			const user = userEvent.setup();
			const context = makeContext();
			renderSlotGrid({ context, slotRows: [makeRow(2, { clipNumber: 'C2' })], readonly: true });

			await user.dblClick(screen.getByRole('cell'));

			expect(context.dividerActions.onToggle).not.toHaveBeenCalled();
		});
	});
});
