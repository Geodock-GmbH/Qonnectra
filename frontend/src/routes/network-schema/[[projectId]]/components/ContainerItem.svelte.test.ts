import type { ComponentProps } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import ContainerItem from './ContainerItem.svelte';

/**
 * Render ContainerItem with a partial props object. The component's callback
 * props are optional at runtime for these tests, so cast to the component props type.
 */
function renderItem(props: Record<string, unknown>) {
	return render(ContainerItem, props as unknown as ComponentProps<typeof ContainerItem>);
}

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

/**
 * Build a container object matching the properties the component renders.
 */
function makeContainer(overrides: Record<string, unknown> = {}) {
	return {
		uuid: 'container-1',
		name: 'Rack A',
		display_name: 'Rack A',
		container_type_name: 'Rack',
		is_expanded: false,
		children: [],
		slot_configurations: [],
		...overrides
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ContainerItem', () => {
	test('should render the container display name', () => {
		renderItem({ container: makeContainer() });

		expect(screen.getByText('Rack A')).toBeInTheDocument();
	});

	test('should not render a chevron toggle when there are no children or slot configs', () => {
		const onToggleExpand = vi.fn();
		renderItem({ container: makeContainer(), onToggleExpand });

		// The only rendered buttons should be edit + delete, no expand chevron.
		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(2);
	});

	test('should render edit and delete actions when not readonly', () => {
		renderItem({ container: makeContainer() });

		expect(screen.getByRole('button', { name: 'common_edit' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'common_delete' })).toBeInTheDocument();
	});

	test('should hide edit and delete actions when readonly', () => {
		renderItem({ container: makeContainer(), readonly: true });

		expect(screen.queryByRole('button', { name: 'common_edit' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'common_delete' })).not.toBeInTheDocument();
	});

	test('should call onToggleExpand with the container uuid when the chevron is clicked', async () => {
		const user = userEvent.setup();
		const onToggleExpand = vi.fn();
		renderItem({
			container: makeContainer({ children: [makeContainer({ uuid: 'child-1' })] }),
			onToggleExpand
		});

		// First button is the expand chevron (children present, so it renders).
		const buttons = screen.getAllByRole('button');
		await user.click(buttons[0]);

		expect(onToggleExpand).toHaveBeenCalledWith('container-1');
	});

	test('should call onDelete with the container uuid', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		renderItem({ container: makeContainer(), onDelete });

		await user.click(screen.getByRole('button', { name: 'common_delete' }));

		expect(onDelete).toHaveBeenCalledWith('container-1');
	});

	test('should enter edit mode and save the trimmed new name via onUpdateName', async () => {
		const user = userEvent.setup();
		const onUpdateName = vi.fn();
		renderItem({ container: makeContainer(), onUpdateName });

		await user.click(screen.getByRole('button', { name: 'common_edit' }));

		const input = screen.getByDisplayValue('Rack A');
		await user.clear(input);
		await user.type(input, '  Rack B  ');
		await user.click(screen.getByRole('button', { name: 'action_save' }));

		expect(onUpdateName).toHaveBeenCalledWith('container-1', 'Rack B');
	});

	test('should cancel editing without calling onUpdateName', async () => {
		const user = userEvent.setup();
		const onUpdateName = vi.fn();
		renderItem({ container: makeContainer(), onUpdateName });

		await user.click(screen.getByRole('button', { name: 'common_edit' }));
		await user.click(screen.getByRole('button', { name: 'common_cancel' }));

		expect(onUpdateName).not.toHaveBeenCalled();
		// Back to display mode.
		expect(screen.getByText('Rack A')).toBeInTheDocument();
	});

	test('should render child containers when expanded', () => {
		renderItem({
			container: makeContainer({
				is_expanded: true,
				children: [makeContainer({ uuid: 'child-1', display_name: 'Rack A / Shelf 1' })]
			})
		});

		expect(screen.getByText('Rack A / Shelf 1')).toBeInTheDocument();
	});

	test('should not render child containers when collapsed', () => {
		renderItem({
			container: makeContainer({
				is_expanded: false,
				children: [makeContainer({ uuid: 'child-1', display_name: 'Rack A / Shelf 1' })]
			})
		});

		expect(screen.queryByText('Rack A / Shelf 1')).not.toBeInTheDocument();
	});

	test('should call onMove when a container is dropped onto this item', async () => {
		const onMove = vi.fn();
		renderItem({ container: makeContainer(), onMove });

		const treeitem = screen.getByRole('treeitem');
		const payload = JSON.stringify({ type: 'container', uuid: 'other-container' });
		const dataTransfer = {
			types: ['application/json'],
			getData: vi.fn(() => payload),
			setData: vi.fn(),
			dropEffect: ''
		};

		const dropEvent = new Event('drop', { bubbles: true }) as unknown as DragEvent;
		Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
		treeitem.dispatchEvent(dropEvent);

		expect(onMove).toHaveBeenCalledWith(
			{ type: 'container', uuid: 'other-container' },
			'container-1'
		);
	});

	test('should not call onMove when dropping a container onto itself', async () => {
		const onMove = vi.fn();
		renderItem({ container: makeContainer(), onMove });

		const treeitem = screen.getByRole('treeitem');
		const payload = JSON.stringify({ type: 'container', uuid: 'container-1' });
		const dataTransfer = {
			types: ['application/json'],
			getData: vi.fn(() => payload),
			setData: vi.fn(),
			dropEffect: ''
		};

		const dropEvent = new Event('drop', { bubbles: true }) as unknown as DragEvent;
		Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
		treeitem.dispatchEvent(dropEvent);

		expect(onMove).not.toHaveBeenCalled();
	});
});
