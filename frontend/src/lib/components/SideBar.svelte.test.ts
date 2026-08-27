import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { updateUserStore } from '$lib/stores/auth';
import { sidebarPreferences } from '$lib/stores/sidebarPreferences';
import { sidebarExpanded } from '$lib/stores/store';

import SideBar from './SideBar.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/dashboard') }
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_DOCUMENTATION_URL: 'https://docs.example/' }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const fullAccess = { is_superuser: true, routes: {} } as never;

beforeEach(() => {
	updateUserStore({ isAuthenticated: true, permissions: fullAccess });
	sidebarExpanded.set(true);
	sidebarPreferences.set({ hiddenRoutes: [], collapsedGroups: [] });
	localStorage.clear();
});

describe('SideBar', () => {
	test('should render all navigation sections for a superuser', () => {
		render(SideBar);

		expect(screen.getByLabelText('nav_dashboard')).toBeInTheDocument();
		expect(screen.getByLabelText('nav_map')).toBeInTheDocument();
		expect(screen.getByLabelText('nav_fault_simulation')).toBeInTheDocument();
		expect(screen.getByLabelText('nav_network_schema')).toBeInTheDocument();
		expect(screen.getByLabelText('nav_settings')).toBeInTheDocument();
	});

	test('should hide links the user has no permission for', () => {
		updateUserStore({
			isAuthenticated: true,
			permissions: {
				is_superuser: false,
				routes: { '/valuation': false, '/admin/logs': false }
			} as never
		});

		render(SideBar);

		expect(screen.queryByLabelText('nav_valuation')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('nav_logs')).not.toBeInTheDocument();
		expect(screen.getByLabelText('nav_dashboard')).toBeInTheDocument();
	});

	test('should hide everything without permissions', () => {
		updateUserStore({ isAuthenticated: true, permissions: undefined });

		render(SideBar);

		expect(screen.queryByLabelText('nav_dashboard')).not.toBeInTheDocument();
	});

	test('should render in rail mode when collapsed', () => {
		sidebarExpanded.set(false);

		const { container } = render(SideBar);

		expect(container.querySelector('[data-layout="rail"]')).not.toBeNull();
	});

	test('should render in sidebar mode when expanded', () => {
		const { container } = render(SideBar);

		expect(container.querySelector('[data-layout="sidebar"]')).not.toBeNull();
	});

	test('should not show route hide toggles until customizing', () => {
		render(SideBar);

		expect(screen.queryByLabelText('action_hide_route')).not.toBeInTheDocument();
	});

	test('should hide a route when toggled off in customize mode', async () => {
		const user = userEvent.setup();
		render(SideBar);

		await user.click(screen.getByLabelText('action_customize_sidebar'));
		// The map link now has a hide toggle; hide it.
		const mapRow = screen.getByLabelText('nav_map').closest('div');
		const hideButton = mapRow?.querySelector('button');
		expect(hideButton).not.toBeNull();
		await user.click(hideButton as HTMLButtonElement);

		// Leaving customize mode removes the hidden link entirely.
		await user.click(screen.getByLabelText('action_done_customizing'));

		expect(screen.queryByLabelText('nav_map')).not.toBeInTheDocument();
		expect(screen.getByLabelText('nav_dashboard')).toBeInTheDocument();
	});

	test('should persist hidden routes to localStorage', async () => {
		const user = userEvent.setup();
		render(SideBar);

		await user.click(screen.getByLabelText('action_customize_sidebar'));
		const mapRow = screen.getByLabelText('nav_map').closest('div');
		await user.click(mapRow?.querySelector('button') as HTMLButtonElement);

		const stored = JSON.parse(localStorage.getItem('sidebarPreferences') ?? '{}');
		expect(stored.hiddenRoutes).toContain('map');
	});

	test('should collapse a group when its label is clicked', async () => {
		const user = userEvent.setup();
		render(SideBar);

		// The 'main' group label toggles collapse; collapsing hides its links.
		await user.click(screen.getByText('nav_category_main'));

		expect(screen.queryByLabelText('nav_dashboard')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('nav_map')).not.toBeInTheDocument();
		// Other groups stay visible.
		expect(screen.getByLabelText('nav_fault_simulation')).toBeInTheDocument();
	});

	test('should persist collapsed groups to localStorage', async () => {
		const user = userEvent.setup();
		render(SideBar);

		await user.click(screen.getByText('nav_category_main'));

		const stored = JSON.parse(localStorage.getItem('sidebarPreferences') ?? '{}');
		expect(stored.collapsedGroups).toContain('main');
	});

	test('reset restores all hidden routes and collapsed groups', async () => {
		const user = userEvent.setup();
		sidebarPreferences.set({ hiddenRoutes: ['map'], collapsedGroups: ['procedure'] });
		render(SideBar);

		await user.click(screen.getByLabelText('action_customize_sidebar'));
		await user.click(screen.getByLabelText('action_reset_sidebar'));
		await user.click(screen.getByLabelText('action_done_customizing'));

		expect(screen.getByLabelText('nav_map')).toBeInTheDocument();
		expect(screen.getByLabelText('nav_fault_simulation')).toBeInTheDocument();
	});
});
