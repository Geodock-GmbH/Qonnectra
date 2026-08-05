import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import FibersStatusTable from './FibersStatusTable.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const getColorHex = () => '#ff0000';

const fibers = [
	{
		uuid: 'fiber-1',
		fiber_number_absolute: 1,
		fiber_number_in_bundle: 1,
		fiber_color: 'rot',
		bundle_number: 1,
		bundle_color: 'rot',
		fiber_status: null
	},
	{
		uuid: 'fiber-2',
		fiber_number_absolute: 2,
		fiber_number_in_bundle: 2,
		fiber_color: 'grün',
		bundle_number: 2,
		bundle_color: 'grün',
		fiber_status: { id: 1, fiber_status: 'defekt' }
	}
];

describe('FibersStatusTable', () => {
	test('should show loading, error, and empty states', () => {
		const { container, unmount } = render(FibersStatusTable, {
			loading: true,
			fibers: [],
			statusOptions: [],
			onStatusChange: vi.fn(),
			getColorHex
		});
		expect(container.querySelector('.animate-pulse')).not.toBeNull();
		unmount();

		render(FibersStatusTable, {
			loading: false,
			error: 'Kaputt',
			fibers: [],
			statusOptions: [],
			onStatusChange: vi.fn(),
			getColorHex
		});
		expect(screen.getByText('Kaputt')).toBeInTheDocument();
	});

	test('should group fibers into one collapsible section per bundle', async () => {
		const user = userEvent.setup();
		render(FibersStatusTable, {
			loading: false,
			fibers,
			statusOptions: [{ id: 1, fiber_status: 'defekt' }],
			onStatusChange: vi.fn(),
			getColorHex
		});

		const toggles = screen.getAllByRole('button');
		expect(toggles.length).toBeGreaterThanOrEqual(2);

		await user.click(toggles[0]);
		expect(screen.getAllByText(/label_fiber_healthy/).length).toBeGreaterThanOrEqual(1);
	});
});
