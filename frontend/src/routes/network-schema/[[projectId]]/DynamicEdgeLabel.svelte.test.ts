import type { ComponentProps } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';

import DynamicEdgeLabel from './DynamicEdgeLabel.svelte';
import DynamicEdgeLabelTestHarness from './DynamicEdgeLabelTestHarness.svelte';

/**
 * Renders the label through a harness that provides the schema-state context
 * the component reads for shift-cue styling.
 */
function renderLabel(labelProps: ComponentProps<typeof DynamicEdgeLabel>) {
	return render(DynamicEdgeLabelTestHarness, {
		labelProps,
		schemaState: { loadCableDetails: loadCableDetailsMock }
	});
}

vi.mock('$app/environment', () => ({
	browser: true
}));

const screenToFlowPositionMock = vi.hoisted(() =>
	vi.fn((p: { x: number; y: number }) => ({ x: p.x, y: p.y }))
);

vi.mock('@xyflow/svelte', () => ({
	useSvelteFlow: () => ({ screenToFlowPosition: screenToFlowPositionMock })
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

vi.mock('./DrawerTabs.svelte', () => ({
	default: () => {}
}));

const loadCableDetailsMock = vi.fn();

const baseProps = {
	edgeId: 'edge-1',
	labelData: { uuid: 'label-1', text: 'K-Nord', position_x: 100, position_y: 50 },
	cableData: { uuid: 'cab-1', cable: { uuid: 'cab-1', name: 'K-Nord' } },
	defaultX: 200,
	defaultY: 80,
	onPositionUpdate: vi.fn(),
	onLabelReset: vi.fn(),
	onEdgeDelete: vi.fn(),
	onEdgeSelect: vi.fn()
};

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	loadCableDetailsMock.mockResolvedValue({ name: 'K-Details', uuid: 'cab-1' });
});

afterEach(() => {
	vi.restoreAllMocks();
	loadCableDetailsMock.mockReset();
	screenToFlowPositionMock.mockClear();
	drawerStore.close();
});

describe('DynamicEdgeLabel', () => {
	test('should render the label text from labelData', () => {
		renderLabel({ ...baseProps });

		expect(screen.getByText('K-Nord')).toBeInTheDocument();
	});

	test('should fall back to cableData.cable.name when labelData has no text', () => {
		renderLabel({
			...baseProps,
			labelData: { uuid: 'label-1', position_x: 100, position_y: 50 }
		});

		expect(screen.getByText('K-Nord')).toBeInTheDocument();
	});

	test('should render nothing when there is no label text at all', () => {
		renderLabel({
			edgeId: 'edge-1',
			labelData: { uuid: 'label-1' },
			cableData: { uuid: 'cab-1', cable: { uuid: 'cab-1' } },
			defaultX: 0,
			defaultY: 0,
			onPositionUpdate: vi.fn(),
			onLabelReset: vi.fn(),
			onEdgeDelete: vi.fn(),
			onEdgeSelect: vi.fn()
		});

		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	test('should apply the selected border styling when selected', () => {
		renderLabel({ ...baseProps, selected: true });

		const label = screen.getByText('K-Nord');
		expect(label.className).toContain('border-primary-500');
	});

	test('should fetch cable details, select the edge, and open the drawer on click', async () => {
		const user = userEvent.setup();
		const onEdgeSelect = vi.fn();
		const openSpy = vi.spyOn(drawerStore, 'open');
		loadCableDetailsMock.mockResolvedValue({ name: 'K-Details', uuid: 'cab-1' });

		renderLabel({ ...baseProps, onEdgeSelect });

		await user.click(screen.getByRole('button', { name: /tooltip_open_cable_details/ }));

		expect(onEdgeSelect).toHaveBeenCalledWith('edge-1');

		await vi.waitFor(() => expect(loadCableDetailsMock).toHaveBeenCalledWith('cab-1'));

		await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
		const openArg = openSpy.mock.calls[0][0] as { props: Record<string, unknown> };
		expect(openArg.props.type).toBe('edge');
	});

	test('should reset the label position on Shift+Click and call onLabelReset', async () => {
		const user = userEvent.setup();
		const onLabelReset = vi.fn();

		renderLabel({ ...baseProps, onLabelReset });

		const button = screen.getByRole('button', { name: /tooltip_open_cable_details/ });

		await user.keyboard('{Shift>}');
		await user.click(button);
		await user.keyboard('{/Shift}');

		expect(onLabelReset).toHaveBeenCalledWith('label-1');
		// A reset short-circuits before any cable detail load.
		expect(loadCableDetailsMock).not.toHaveBeenCalled();
	});

	test('should reset on Shift+Click even when the Shift keydown was never observed', async () => {
		const onLabelReset = vi.fn();

		renderLabel({ ...baseProps, onLabelReset });

		const button = screen.getByRole('button', { name: /tooltip_open_cable_details/ });

		// No keyboard events fired: Shift was pressed while focus was elsewhere,
		// so only the click event itself carries the modifier.
		await fireEvent.click(button, { shiftKey: true });

		expect(onLabelReset).toHaveBeenCalledWith('label-1');
		expect(loadCableDetailsMock).not.toHaveBeenCalled();
	});

	test('should roll the label position back when the reset fails to persist', async () => {
		let resolveReset!: (value: boolean) => void;
		const onLabelReset = vi.fn(() => new Promise<boolean>((resolve) => (resolveReset = resolve)));

		const { container } = renderLabel({ ...baseProps, onLabelReset });

		const foreignObject = container.querySelector('foreignObject');
		// Rendered at the stored label position (position_y 50 - 12 offset).
		expect(foreignObject?.getAttribute('y')).toBe('38');

		await fireEvent.click(screen.getByRole('button', { name: /tooltip_open_cable_details/ }), {
			shiftKey: true
		});

		// Optimistically moved to the default position (defaultY 80 - 12 offset).
		expect(foreignObject?.getAttribute('y')).toBe('68');

		resolveReset(false);
		await vi.waitFor(() => expect(foreignObject?.getAttribute('y')).toBe('38'));
	});

	test('should keep the reset position when the reset persists', async () => {
		const onLabelReset = vi.fn().mockResolvedValue(true);

		const { container } = renderLabel({ ...baseProps, onLabelReset });

		await fireEvent.click(screen.getByRole('button', { name: /tooltip_open_cable_details/ }), {
			shiftKey: true
		});

		const foreignObject = container.querySelector('foreignObject');
		await vi.waitFor(() => expect(foreignObject?.getAttribute('y')).toBe('68'));
	});

	test('should reset instead of entering move mode when a Shift+Click is held past the long-press delay', async () => {
		vi.useFakeTimers();
		try {
			const onPositionUpdate = vi.fn();
			const onLabelReset = vi.fn().mockResolvedValue(true);

			const { container } = renderLabel({
				...baseProps,
				onPositionUpdate,
				onLabelReset
			});

			const foreignObject = container.querySelector('foreignObject')!;

			await fireEvent.mouseDown(foreignObject, { shiftKey: true });
			vi.advanceTimersByTime(600);
			await fireEvent.mouseUp(foreignObject, { shiftKey: true });
			await fireEvent.click(screen.getByRole('button', { name: /tooltip/ }), {
				shiftKey: true
			});

			expect(onPositionUpdate).not.toHaveBeenCalled();
			expect(onLabelReset).toHaveBeenCalledWith('label-1');
		} finally {
			vi.useRealTimers();
		}
	});

	test('should open the drawer on Enter keydown for accessibility', async () => {
		const user = userEvent.setup();
		const openSpy = vi.spyOn(drawerStore, 'open');

		renderLabel({ ...baseProps });

		const button = screen.getByRole('button', { name: /tooltip_open_cable_details/ });
		button.focus();
		await user.keyboard('{Enter}');

		await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
	});
});
