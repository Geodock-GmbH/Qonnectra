import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import SlotConfigItem from './SlotConfigItem.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

function makeConfig(overrides: Record<string, unknown> = {}) {
	return {
		uuid: 'cfg-1',
		side: 'A-Seite',
		total_slots: 12,
		used_slots: 4,
		free_slots: 8,
		...overrides
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SlotConfigItem', () => {
	test('should render the side label and slot counts', () => {
		render(SlotConfigItem, { config: makeConfig() });

		expect(screen.getByText('A-Seite')).toBeInTheDocument();
		const stats = screen.getByText(/form_total_slots/).textContent ?? '';
		expect(stats).toContain('12');
		expect(stats).toContain('4');
		expect(stats).toContain('8');
	});

	test('should fall back to total_slots for free slots and 0 for used when missing', () => {
		render(SlotConfigItem, {
			config: makeConfig({ used_slots: undefined, free_slots: undefined, total_slots: 24 })
		});

		const stats = screen.getByText(/form_total_slots/).textContent ?? '';
		// used_slots defaults to 0, free_slots defaults to total_slots (24).
		expect(stats).toContain('0');
		expect(stats).toContain('24');
	});

	test('should call onViewStructure with the config uuid', async () => {
		const user = userEvent.setup();
		const onViewStructure = vi.fn();
		render(SlotConfigItem, { config: makeConfig(), onViewStructure });

		await user.click(screen.getByRole('button', { name: 'action_view_structure' }));

		expect(onViewStructure).toHaveBeenCalledWith('cfg-1');
	});

	test('should call onEdit with the whole config', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const config = makeConfig();
		render(SlotConfigItem, { config, onEdit });

		await user.click(screen.getByRole('button', { name: 'common_edit' }));

		expect(onEdit).toHaveBeenCalledWith(config);
	});

	test('should call onDelete with the config uuid', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(SlotConfigItem, { config: makeConfig(), onDelete });

		await user.click(screen.getByRole('button', { name: 'common_delete' }));

		expect(onDelete).toHaveBeenCalledWith('cfg-1');
	});

	test('should hide edit/delete and grip in readonly mode but keep view', () => {
		render(SlotConfigItem, { config: makeConfig(), readonly: true });

		expect(screen.getByRole('button', { name: 'action_view_structure' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'common_edit' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'common_delete' })).not.toBeInTheDocument();
	});

	test('should be draggable and not draggable in readonly', () => {
		const { container, unmount } = render(SlotConfigItem, { config: makeConfig() });
		const item = container.querySelector('.slot-config-item') as HTMLElement;
		expect(item.getAttribute('draggable')).toBe('true');
		unmount();

		const { container: roContainer } = render(SlotConfigItem, {
			config: makeConfig(),
			readonly: true
		});
		const roItem = roContainer.querySelector('.slot-config-item') as HTMLElement;
		expect(roItem.getAttribute('draggable')).toBe('false');
	});

	test('should apply indentation based on depth', () => {
		const { container } = render(SlotConfigItem, { config: makeConfig(), depth: 2 });
		const item = container.querySelector('.slot-config-item') as HTMLElement;
		// depth * 1.5rem = 3rem
		expect(item.style.paddingLeft).toBe('3rem');
	});

	test('should set drag payload with slot_configuration type and uuid on dragstart', () => {
		const onDragStart = vi.fn();
		const { container } = render(SlotConfigItem, {
			config: makeConfig({ uuid: 'drag-uuid' }),
			onDragStart
		});
		const item = container.querySelector('.slot-config-item') as HTMLElement;

		const setData = vi.fn();
		const dataTransfer = { setData, effectAllowed: '' };
		const dragEvent = new Event('dragstart', { bubbles: true }) as unknown as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dataTransfer });
		item.dispatchEvent(dragEvent);

		expect(setData).toHaveBeenCalledTimes(1);
		expect(setData.mock.calls[0][0]).toBe('application/json');
		expect(JSON.parse(setData.mock.calls[0][1])).toEqual({
			type: 'slot_configuration',
			uuid: 'drag-uuid'
		});
		expect(dataTransfer.effectAllowed).toBe('move');
		expect(onDragStart).toHaveBeenCalledTimes(1);
	});

	test('should prevent the drag and not set payload in readonly mode', () => {
		const onDragStart = vi.fn();
		const { container } = render(SlotConfigItem, {
			config: makeConfig(),
			readonly: true,
			onDragStart
		});
		const item = container.querySelector('.slot-config-item') as HTMLElement;

		const setData = vi.fn();
		const dataTransfer = { setData, effectAllowed: '' };
		const dragEvent = new Event('dragstart', {
			bubbles: true,
			cancelable: true
		}) as unknown as DragEvent;
		Object.defineProperty(dragEvent, 'dataTransfer', { value: dataTransfer });
		item.dispatchEvent(dragEvent);

		expect(setData).not.toHaveBeenCalled();
		expect(onDragStart).not.toHaveBeenCalled();
		expect(dragEvent.defaultPrevented).toBe(true);
	});
});
