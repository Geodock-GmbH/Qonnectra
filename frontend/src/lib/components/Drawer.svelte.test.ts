import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';

import Drawer from './Drawer.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/navigation', () => ({
	beforeNavigate: vi.fn()
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
	drawerStore.close();
	drawerStore.setTitle('');
});

describe('Drawer', () => {
	test('should render nothing while closed', () => {
		const { container } = render(Drawer);

		expect(container.querySelector('[data-drawer]')).toBeNull();
	});

	test('should open with the store title', async () => {
		render(Drawer);

		drawerStore.open({ title: 'Grabendetails' });

		expect(await screen.findByText('Grabendetails')).toBeInTheDocument();
		expect(document.querySelector('[data-drawer]')).not.toBeNull();
	});

	test('should fall back to a default title', async () => {
		render(Drawer);

		drawerStore.open({});

		expect(await screen.findByText('Details')).toBeInTheDocument();
	});

	test('should close via the close button', async () => {
		const user = userEvent.setup();
		render(Drawer);
		drawerStore.open({ title: 'Grabendetails' });
		await screen.findByText('Grabendetails');

		await user.click(screen.getByRole('button', { name: 'tooltip_close_drawer' }));

		let open = true;
		const unsubscribe = drawerStore.subscribe((state) => (open = state.open));
		unsubscribe();
		expect(open).toBe(false);
	});

	test('should close on Escape', async () => {
		render(Drawer);
		drawerStore.open({ title: 'Grabendetails' });
		await screen.findByText('Grabendetails');

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		let open = true;
		const unsubscribe = drawerStore.subscribe((state) => (open = state.open));
		unsubscribe();
		expect(open).toBe(false);
	});

	test('should apply the store width to the desktop drawer', async () => {
		render(Drawer);

		drawerStore.open({ title: 'Breit', width: 555 });
		await screen.findByText('Breit');

		const drawer = document.querySelector('[data-drawer]') as HTMLElement;
		expect(drawer.getAttribute('style')).toContain('width: 555px');
	});
});
