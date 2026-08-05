import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import Harness from './ComponentTypeSidebarTestHarness.svelte';

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
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

const fetchMock = vi.fn();

const componentTypes = [
	{ id: 1, component_type: 'Splice Tray', occupied_slots: 2 },
	{ id: 2, component_type: 'Patch Panel', occupied_slots: 4 }
];

/**
 * Stub the ?/getComponentTypes form action response.
 */
function mockComponentTypes(types: unknown[] = componentTypes) {
	fetchMock.mockResolvedValue({
		ok: true,
		text: () =>
			Promise.resolve(JSON.stringify({ type: 'success', data: { componentTypes: types } }))
	});
}

/**
 * Minimal drag-drop manager stub exposing the methods the component calls.
 */
function makeDragDropManager() {
	return {
		startComponentDrag: vi.fn(),
		startMultiComponentDrag: vi.fn(),
		endDrag: vi.fn(),
		selectMobileComponent: vi.fn()
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('ComponentTypeSidebar (desktop)', () => {
	test('should fetch and render component types with slot counts', async () => {
		mockComponentTypes();
		render(Harness, {});

		expect(await screen.findByText('Splice Tray')).toBeInTheDocument();
		expect(screen.getByText('Patch Panel')).toBeInTheDocument();

		const getCall = fetchMock.mock.calls.find(([url]) => url === '?/getComponentTypes');
		expect(getCall).toBeTruthy();
	});

	test('should show the empty message when no component types exist', async () => {
		mockComponentTypes([]);
		render(Harness, {});

		expect(await screen.findByText('message_no_component_types')).toBeInTheDocument();
	});

	test('should increment quantity and update the displayed slot total', async () => {
		const user = userEvent.setup();
		mockComponentTypes();
		render(Harness, {});

		await screen.findByText('Splice Tray');

		// Splice Tray has 2 occupied_slots; at qty 1 the slot text renders "2 form_slot:2".
		expect(screen.getByText(/form_slot:2/)).toBeInTheDocument();

		// The plus button is the last button inside the first item's control cluster.
		const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
		expect(inputs[0].value).toBe('1');

		// Find the increment button adjacent to the first quantity input.
		const incButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg'));
		// Buttons order per item: collapse chevron (global), then per-item [minus, plus].
		// Locate by clicking the plus next to the first input via its parent toolbar.
		const firstToolbar = inputs[0].parentElement as HTMLElement;
		const toolbarButtons = firstToolbar.querySelectorAll('button');
		const plusButton = toolbarButtons[toolbarButtons.length - 1] as HTMLButtonElement;
		await user.click(plusButton);

		expect(inputs[0].value).toBe('2');
		// qty 2 -> occupied_slots(2) * 2 = 4, and a "(2x)" multiplier is shown on this item only.
		const firstItem = screen.getByText('Splice Tray').closest('[role="listitem"]') as HTMLElement;
		expect(firstItem.textContent).toContain('form_slot:4');
		expect(firstItem.textContent).toContain('(2x)');
		expect(incButtons.length).toBeGreaterThan(0);
	});

	test('should start a single-component drag and set drag payload', async () => {
		mockComponentTypes();
		const dragDropManager = makeDragDropManager();
		render(Harness, { dragDropManager });

		await screen.findByText('Splice Tray');

		const item = screen.getByText('Splice Tray').closest('[role="listitem"]') as HTMLElement;
		const setData = vi.fn();
		const dataTransfer = { setData, effectAllowed: '' };
		const dragEvent = new Event('dragstart', { bubbles: true }) as unknown as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dataTransfer });
		item.dispatchEvent(dragEvent);

		expect(dragDropManager.startComponentDrag).toHaveBeenCalled();
		const payload = JSON.parse(setData.mock.calls[0][1]);
		expect(payload).toMatchObject({ type: 'component_type', id: 1, name: 'Splice Tray' });
	});

	test('should collapse and expand the sidebar', async () => {
		const user = userEvent.setup();
		mockComponentTypes();
		render(Harness, {});

		await screen.findByText('Splice Tray');

		const collapseBtn = screen.getByRole('button', { name: 'action_collapse' });
		await user.click(collapseBtn);

		// Header and items are hidden while collapsed; an expand control is offered instead.
		expect(screen.queryByText('Splice Tray')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'action_expand' })).toBeInTheDocument();
	});
});

describe('ComponentTypeSidebar (mobile)', () => {
	test('should render tappable rows and select on click', async () => {
		const user = userEvent.setup();
		mockComponentTypes();
		const dragDropManager = makeDragDropManager();
		const onMobileSelect = vi.fn();
		render(Harness, { isMobile: true, dragDropManager, onMobileSelect });

		await screen.findByText('Splice Tray');

		await user.click(screen.getByText('Splice Tray'));

		expect(dragDropManager.selectMobileComponent).toHaveBeenCalled();
		expect(onMobileSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
	});
});
