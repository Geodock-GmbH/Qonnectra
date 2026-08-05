import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import FibersDisplayTable from './FibersDisplayTable.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const getColorHex = (name: string) => (name === 'rot' ? '#ff0000' : '#808080');

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
		bundle_number: 1,
		bundle_color: 'rot',
		fiber_status: { id: 1, fiber_status: 'defekt' }
	},
	{
		uuid: 'fiber-3',
		fiber_number_absolute: 13,
		fiber_number_in_bundle: 1,
		fiber_color: 'rot',
		bundle_number: 2,
		bundle_color: 'grün',
		fiber_status: null
	}
];

describe('FibersDisplayTable', () => {
	test('should show a pulsing placeholder while loading', () => {
		const { container } = render(FibersDisplayTable, {
			loading: true,
			fibers: [],
			getColorHex
		});

		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	test('should show the error message on failure', () => {
		render(FibersDisplayTable, { loading: false, error: 'Fehler', fibers: [], getColorHex });

		expect(screen.getByText('Fehler')).toBeInTheDocument();
	});

	test('should show an empty state without fibers', () => {
		render(FibersDisplayTable, { loading: false, fibers: [], getColorHex });

		expect(screen.getByText('form_no_fibers_available')).toBeInTheDocument();
	});

	test('should group fibers into collapsed bundles', () => {
		render(FibersDisplayTable, { loading: false, fibers, getColorHex });

		const bundleToggles = screen.getAllByRole('button');
		expect(bundleToggles.length).toBeGreaterThanOrEqual(2);
		expect(screen.queryByText('defekt')).not.toBeInTheDocument();
	});

	test('should expand a bundle to reveal its fibers and statuses', async () => {
		const user = userEvent.setup();
		render(FibersDisplayTable, { loading: false, fibers, getColorHex });

		await user.click(screen.getAllByRole('button')[0]);

		expect(screen.getByText('defekt')).toBeInTheDocument();
		expect(screen.getAllByText('label_fiber_healthy').length).toBeGreaterThanOrEqual(1);
	});
});
