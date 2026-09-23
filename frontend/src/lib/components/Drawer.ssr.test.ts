import { render } from 'svelte/server';
import { describe, expect, test, vi } from 'vitest';

import Drawer from './Drawer.svelte';

vi.mock('$app/environment', () => ({
	browser: false
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

/**
 * Renders on the server, where there is no `window`. This runs in the node
 * test project, so a component reaching for `window` throws here exactly as
 * it does during SSR.
 */
describe('Drawer on the server', () => {
	// `innerWidth` is unknown server-side, so the component takes its mobile
	// branch and renders the bottom sheet; any `window` access there 500s
	// every deep link that opens a drawer.
	test('should render the drawer markup so a deep link is not an empty page', () => {
		const { body } = render(Drawer, {
			props: { open: true, title: 'Grabendetails', onclose: () => {} }
		});

		expect(body).toContain('data-drawer');
		expect(body).toContain('Grabendetails');
	});

	test('should render nothing while closed', () => {
		const { body } = render(Drawer, { props: { open: false, onclose: () => {} } });

		expect(body).not.toContain('data-drawer');
	});
});
