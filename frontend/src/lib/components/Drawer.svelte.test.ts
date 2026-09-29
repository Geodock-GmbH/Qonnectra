import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerWidth } from '$lib/stores/store';

import Drawer from './Drawer.svelte';

vi.mock('$app/environment', () => ({
	browser: true
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
	drawerWidth.set(400);
});

describe('Drawer', () => {
	test('should render nothing while closed', () => {
		const { container } = render(Drawer, { open: false, onclose: vi.fn() });

		expect(container.querySelector('[data-drawer]')).toBeNull();
	});

	test('should show the title while open', () => {
		render(Drawer, { open: true, title: 'Grabendetails', onclose: vi.fn() });

		expect(screen.getByText('Grabendetails')).toBeInTheDocument();
		expect(document.querySelector('[data-drawer]')).not.toBeNull();
	});

	test('should fall back to a default title', () => {
		render(Drawer, { open: true, onclose: vi.fn() });

		expect(screen.getByText('Details')).toBeInTheDocument();
	});

	test('should report a close via the close button, never closing itself', async () => {
		const user = userEvent.setup();
		const onclose = vi.fn();
		render(Drawer, { open: true, title: 'Grabendetails', onclose });

		await user.click(screen.getByRole('button', { name: 'tooltip_close_drawer' }));

		expect(onclose).toHaveBeenCalledOnce();
		expect(document.querySelector('[data-drawer]')).not.toBeNull();
	});

	test('should report a close on Escape', () => {
		const onclose = vi.fn();
		render(Drawer, { open: true, title: 'Grabendetails', onclose });

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(onclose).toHaveBeenCalledOnce();
	});

	test('should ignore Escape while closed', () => {
		const onclose = vi.fn();
		render(Drawer, { open: false, onclose });

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(onclose).not.toHaveBeenCalled();
	});

	test('should apply the persisted width to the desktop drawer', () => {
		drawerWidth.set(555);
		render(Drawer, { open: true, title: 'Breit', onclose: vi.fn() });

		const drawer = document.querySelector('[data-drawer]') as HTMLElement;
		expect(drawer.getAttribute('style')).toContain('width: 555px');
	});
});
