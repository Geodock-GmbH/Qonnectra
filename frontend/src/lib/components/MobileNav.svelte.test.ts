import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { setLocale } from '$lib/paraglide/runtime';

import { updateUserStore } from '$lib/stores/auth';

import MobileNav from './MobileNav.svelte';

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

beforeEach(() => {
	updateUserStore({ isAuthenticated: true, permissions: fullAccess });
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
		updateUserStore({
			isAuthenticated: true,
			permissions: {
				is_superuser: false,
				routes: { '/fault-simulation': false, '/valuation': false }
			} as never
		});
		render(MobileNav);

		await user.click(screen.getByText('common_more'));

		expect(screen.queryByText('nav_fault_simulation')).not.toBeInTheDocument();
		expect(screen.queryByText('nav_valuation')).not.toBeInTheDocument();
		expect(screen.getByText('nav_pipeline_records')).toBeInTheDocument();
	});

	test('should hide the more menu entirely without permissions', () => {
		updateUserStore({ isAuthenticated: true, permissions: undefined });
		render(MobileNav);

		expect(screen.queryByText('common_more')).not.toBeInTheDocument();
		expect(screen.queryByText('nav_dashboard')).not.toBeInTheDocument();
	});

	test('should switch the locale from the more menu', async () => {
		const user = userEvent.setup();
		render(MobileNav);

		await user.click(screen.getByText('common_more'));
		await user.click(screen.getByText('EN'));

		expect(setLocale).toHaveBeenCalledWith('en');
	});
});
