import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { updateUserStore } from '$lib/stores/auth';
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
});
