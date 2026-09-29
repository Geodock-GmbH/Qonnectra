import { get } from 'svelte/store';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { setLocale } from '$lib/paraglide/runtime';

import { sidebarPreferences } from '$lib/stores/sidebarPreferences';
import { pageStub } from '$lib/test-utils/pageStub';

import MobileNav from './MobileNav.svelte';

const appState = vi.hoisted(() => ({ page: {} as Record<string, unknown> }));

vi.mock('$app/state', () => ({
	page: appState.page
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

vi.mock('$lib/paraglide/runtime', () => ({
	getLocale: () => 'de',
	setLocale: vi.fn()
}));

// jsdom does not implement the Web Animations API used by svelte transitions
Element.prototype.animate = function () {
	const animation = {
		onfinish: null as (() => void) | null,
		oncancel: null,
		cancel() {},
		finish() {},
		pause() {},
		play() {},
		finished: Promise.resolve()
	};
	queueMicrotask(() => animation.onfinish?.());
	return animation as unknown as Animation;
};

const fullAccess = { is_superuser: true, routes: {} } as never;

/**
 * Puts the mocked page on the project dashboard with the given user in its data.
 * @param user - The user the root layout would have loaded.
 */
function setUser(user: Record<string, unknown>) {
	Object.assign(
		appState.page,
		pageStub({
			routeId: '/project/[projectId=integer]/dashboard/[[flagId]]',
			params: { projectId: '7' },
			url: 'http://localhost/project/7/dashboard',
			data: { user }
		})
	);
}

beforeEach(() => {
	setUser({ isAuthenticated: true, permissions: fullAccess });
	sidebarPreferences.set({ hiddenRoutes: [], collapsedGroups: [] });
	vi.mocked(setLocale).mockClear();
});

describe('MobileNav', () => {
	test('should show the main navigation links for a superuser', () => {
		render(MobileNav);

		expect(screen.getByText('nav_dashboard')).toBeInTheDocument();
		expect(screen.getByText('nav_map')).toBeInTheDocument();
	});

	test('should reveal the grouped links via the more menu', async () => {
		const user = userEvent.setup();
		render(MobileNav);

		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();

		await user.click(screen.getByText('common_more'));

		expect(screen.getByText('nav_fault_simulation')).toBeInTheDocument();
		expect(screen.getByText('nav_network_schema')).toBeInTheDocument();
		expect(screen.getByText('nav_settings')).toBeInTheDocument();
	});

	test('should hide links the user has no permission for', async () => {
		const user = userEvent.setup();
		setUser({
			isAuthenticated: true,
			permissions: {
				is_superuser: false,
				routes: { '/fault-simulation': false, '/valuation': false }
			}
		});
		render(MobileNav);

		await user.click(screen.getByText('common_more'));

		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();
		expect(screen.queryByText('nav_valuation')).not.toBeInTheDocument();
		expect(screen.getByText('nav_pipeline_records')).toBeInTheDocument();
	});

	test('should show everything when the permissions could not be loaded', () => {
		setUser({ isAuthenticated: true, permissions: undefined });
		render(MobileNav);

		expect(screen.getByText('common_more')).toBeInTheDocument();
		expect(screen.getByText('nav_dashboard')).toBeInTheDocument();
	});

	test('should point the bar links at the current project', () => {
		render(MobileNav);

		expect(screen.getByText('nav_map').closest('a')).toHaveAttribute('href', '/project/7/map');
	});

	test('should switch the locale from the more menu', async () => {
		const user = userEvent.setup();
		render(MobileNav);

		await user.click(screen.getByText('common_more'));
		await user.click(screen.getByText('EN'));

		expect(setLocale).toHaveBeenCalledWith('en');
	});

	test('should leave out routes hidden in the sidebar', async () => {
		const user = userEvent.setup();
		sidebarPreferences.set({ hiddenRoutes: ['fault-simulation'], collapsedGroups: [] });
		render(MobileNav);

		await user.click(screen.getByText('common_more'));

		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();
		expect(screen.getByText('nav_post_compaction')).toBeInTheDocument();
	});

	test('should drop a group whose routes are all hidden', async () => {
		const user = userEvent.setup();
		sidebarPreferences.set({ hiddenRoutes: ['network-schema', 'trace'], collapsedGroups: [] });
		render(MobileNav);

		await user.click(screen.getByText('common_more'));

		expect(screen.queryByText('nav_category_cable')).not.toBeInTheDocument();
	});

	test('should keep the bar links regardless of hidden routes', () => {
		sidebarPreferences.set({ hiddenRoutes: ['map'], collapsedGroups: [] });
		render(MobileNav);

		expect(screen.getByText('nav_map')).toBeInTheDocument();
	});

	test('should collapse a group from its header and remember it', async () => {
		const user = userEvent.setup();
		render(MobileNav);

		await user.click(screen.getByText('common_more'));
		await user.click(screen.getByText('nav_category_procedure'));

		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();
		expect(screen.getByText('nav_network_schema')).toBeInTheDocument();
		expect(get(sidebarPreferences).collapsedGroups).toEqual(['procedure']);
	});

	test('should show a collapsed group from the sidebar as collapsed', async () => {
		const user = userEvent.setup();
		sidebarPreferences.set({ hiddenRoutes: [], collapsedGroups: ['procedure'] });
		render(MobileNav);

		await user.click(screen.getByText('common_more'));

		expect(screen.getByText('nav_category_procedure').closest('button')).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();
	});

	test('should hide and reveal routes in customize mode', async () => {
		const user = userEvent.setup();
		render(MobileNav);

		await user.click(screen.getByText('common_more'));
		expect(screen.queryByLabelText('action_hide_route')).not.toBeInTheDocument();

		await user.click(screen.getByLabelText('action_customize_sidebar'));
		const faultRow = screen.getByText('nav_fault_simulation').closest('div');
		await user.click(within(faultRow as HTMLElement).getByLabelText('action_hide_route'));

		expect(get(sidebarPreferences).hiddenRoutes).toEqual(['fault-simulation']);
		expect(within(faultRow as HTMLElement).getByLabelText('action_show_route')).toBeInTheDocument();

		await user.click(screen.getByLabelText('action_done_customizing'));

		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();
	});

	test('should reset hidden routes and collapsed groups', async () => {
		const user = userEvent.setup();
		sidebarPreferences.set({ hiddenRoutes: ['fault-simulation'], collapsedGroups: ['cable'] });
		render(MobileNav);

		await user.click(screen.getByText('common_more'));
		await user.click(screen.getByLabelText('action_customize_sidebar'));
		await user.click(screen.getByLabelText('action_reset_sidebar'));
		await user.click(screen.getByLabelText('action_done_customizing'));

		expect(screen.getByText('nav_fault_simulation')).toBeInTheDocument();
		expect(screen.getByText('nav_network_schema')).toBeInTheDocument();
	});

	test('should close the menu when a grouped link is followed', async () => {
		const user = userEvent.setup();
		render(MobileNav);

		await user.click(screen.getByText('common_more'));
		// jsdom cannot navigate; the menu's own click handler still runs first.
		document.addEventListener('click', (event) => event.preventDefault(), { once: true });
		await user.click(screen.getByText('nav_fault_simulation'));

		expect(screen.queryByText('form_more_sites')).not.toBeInTheDocument();
	});
});
