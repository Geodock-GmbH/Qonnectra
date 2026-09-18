import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import { httpError } from '$lib/test-utils/remote-stubs';

import Page from './+page.svelte';

const getDashboardStatistics = vi.fn();

vi.mock('$lib/remote/dashboard/statistics.remote', () => ({
	getDashboardStatistics: (...args: unknown[]) => getDashboardStatistics(...args)
}));

vi.mock('$app/state', () => ({
	page: { params: { projectId: '7' } }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

beforeEach(() => {
	getDashboardStatistics.mockReset();
	getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
});

describe('dashboard +page.svelte', () => {
	test('should open on the overview of the project from the URL', async () => {
		render(Page);

		expect(await screen.findByText('form_trench_statistics')).toBeInTheDocument();
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7' });
	});

	test('should show a loading placeholder until the statistics arrive', async () => {
		getDashboardStatistics.mockReturnValue(new Promise(() => {}));
		render(Page);

		expect(await screen.findByRole('status')).toBeInTheDocument();
		expect(screen.queryByText('form_trench_statistics')).not.toBeInTheDocument();
	});

	test('should switch to the trench charts when the trench tab is selected', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('form_trench_statistics');

		await user.click(screen.getByRole('tab', { name: 'nav_trench' }));

		expect(await screen.findByText('form_length_by_surface')).toBeInTheDocument();
		expect(screen.queryByText('form_trench_statistics')).not.toBeInTheDocument();
	});

	test('should show the backend message and a retry when the statistics fail', async () => {
		getDashboardStatistics.mockRejectedValue(httpError(502, 'Statistics unavailable'));
		render(Page);

		expect(await screen.findByRole('alert')).toHaveTextContent('Statistics unavailable');
		expect(screen.getByRole('button', { name: 'common_retry' })).toBeInTheDocument();
	});
});
