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

const { params, pageState } = vi.hoisted(() => {
	const params: { projectId?: string; flagId?: string } = {};
	return {
		params,
		pageState: {
			params,
			url: new URL('http://localhost/project/7/dashboard'),
			data: { flags: [{ value: '3', label: 'Cluster Nord' }], flagsError: null }
		}
	};
});

vi.mock('$app/state', () => ({ page: pageState }));

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

beforeEach(() => {
	params.projectId = '7';
	delete params.flagId;
	pageState.url = new URL('http://localhost/project/7/dashboard');
	gotoMock.mockReset();
	getDashboardStatistics.mockReset();
	getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
});

describe('dashboard +page.svelte', () => {
	test('should open on the overview of the project from the URL', async () => {
		render(Page);

		expect(await screen.findByText('form_trench_statistics')).toBeInTheDocument();
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7', flagId: '' });
	});

	test('should scope the statistics to the flag from the URL', async () => {
		params.flagId = '3';
		render(Page);

		await screen.findByText('form_trench_statistics');
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7', flagId: '3' });
	});

	test('should show the flag from the URL in the flag picker', async () => {
		params.flagId = '3';
		render(Page);

		expect(await screen.findByRole('combobox')).toHaveValue('Cluster Nord');
	});

	test('should keep the flag scope on a tab named in the URL', async () => {
		params.flagId = '3';
		pageState.url = new URL('http://localhost/project/7/dashboard/3?tab=node');
		render(Page);

		await screen.findByText('form_nodes_by_city');
		expect(screen.getByRole('tab', { name: 'nav_node' })).toHaveAttribute('aria-selected', 'true');
		expect(getDashboardStatistics).toHaveBeenLastCalledWith({ projectId: '7', flagId: '3' });
	});

	test('should fall back to the overview for a tab the URL names wrongly', async () => {
		pageState.url = new URL('http://localhost/project/7/dashboard?tab=nonsense');
		render(Page);

		expect(await screen.findByText('form_trench_statistics')).toBeInTheDocument();
		expect(gotoMock).not.toHaveBeenCalled();
	});

	test('should show a loading placeholder until the statistics arrive', async () => {
		getDashboardStatistics.mockReturnValue(new Promise(() => {}));
		render(Page);

		expect(await screen.findByRole('status')).toBeInTheDocument();
		expect(screen.queryByText('form_trench_statistics')).not.toBeInTheDocument();
	});

	test('should write the selected tab to the URL as an adjustment', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('form_trench_statistics');

		await user.click(screen.getByRole('tab', { name: 'nav_trench' }));

		expect(gotoMock).toHaveBeenCalledWith('/project/7/dashboard?tab=trench', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});

	test('should show the trench charts for the trench tab in the URL', async () => {
		pageState.url = new URL('http://localhost/project/7/dashboard?tab=trench');
		render(Page);

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
