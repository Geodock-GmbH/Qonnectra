import { get } from 'svelte/store';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { updateUserStore } from '$lib/stores/auth';
import { globalMapView, selectedProject } from '$lib/stores/store';

import AppBar from './AppBar.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

const appState = vi.hoisted(() => ({
	page: { url: new URL('http://localhost/dashboard'), params: {} as Record<string, string> }
}));

vi.mock('$app/state', () => ({
	page: appState.page
}));

vi.mock('$app/stores', () => {
	const value = appState.page;
	return {
		page: {
			subscribe(run: (value: typeof appState.page) => void) {
				run(value);
				return () => {};
			}
		}
	};
});

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

vi.mock('$lib/paraglide/runtime', () => ({
	getLocale: () => 'de',
	setLocale: vi.fn()
}));

const data = {
	projects: [{ label: 'Ausbau Nord', value: '7' }],
	projectsError: null,
	appVersion: '1.2.3'
};

beforeEach(() => {
	updateUserStore(null);
	globalMapView.set(false);
	selectedProject.set('7');
	appState.page.url = new URL('http://localhost/dashboard');
	document.cookie = 'selected-project=7; path=/';
});

describe('AppBar', () => {
	test('should show a login link for unauthenticated users', () => {
		render(AppBar, { data });

		expect(screen.getByRole('button', { name: 'tooltip_login' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'tooltip_logout' })).not.toBeInTheDocument();
		expect(screen.queryByPlaceholderText('form_project')).not.toBeInTheDocument();
	});

	test('should show logout and the project combobox when authenticated', () => {
		updateUserStore({ isAuthenticated: true, username: 'malte' });

		render(AppBar, { data });

		expect(screen.getByRole('button', { name: 'tooltip_logout' })).toBeInTheDocument();
		expect(screen.getByPlaceholderText('form_project')).toBeInTheDocument();
	});

	test('should display the app version and documentation link', () => {
		render(AppBar, { data });

		expect(screen.getByText('v1.2.3')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'tooltip_documentation' })).toHaveAttribute(
			'href',
			'https://docs.example/'
		);
	});

	test('should only show the global view toggle on map routes', () => {
		updateUserStore({ isAuthenticated: true });
		appState.page.url = new URL('http://localhost/dashboard');
		const { unmount } = render(AppBar, { data });
		expect(
			screen.queryByRole('button', { name: 'tooltip_view_all_projects' })
		).not.toBeInTheDocument();
		unmount();

		appState.page.url = new URL('http://localhost/map/7');
		render(AppBar, { data });
		expect(screen.getByRole('button', { name: 'tooltip_view_all_projects' })).toBeInTheDocument();
	});

	test('should toggle global map view and restore the cookie project when leaving', async () => {
		const user = userEvent.setup();
		updateUserStore({ isAuthenticated: true });
		appState.page.url = new URL('http://localhost/map/7');
		render(AppBar, { data });

		await user.click(screen.getByRole('button', { name: 'tooltip_view_all_projects' }));
		expect(get(globalMapView)).toBe(true);

		selectedProject.set('99');
		await user.click(screen.getByRole('button', { name: 'tooltip_view_current_project' }));
		expect(get(globalMapView)).toBe(false);
		expect(get(selectedProject)).toBe('7');
	});
});
