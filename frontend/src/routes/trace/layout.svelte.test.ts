import { createRawSnippet } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import { pageStub } from '$lib/test-utils/pageStub';

import Layout from './+layout.svelte';

const page = vi.hoisted(() => ({ current: {} as ReturnType<typeof pageStub> }));

vi.mock('$app/state', () => ({
	get page() {
		return page.current;
	}
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('./components/TraceMapPanel.svelte', async () => ({
	default: (await import('./components/TraceMapPanelStub.svelte')).default
}));

const result = createRawSnippet(() => ({
	render: () => '<p>trace result</p>'
}));

/**
 * Renders the trace layout on a trace page.
 * @param entryType - Route slug of the traced entity.
 * @param query - The page's query string, without `?`.
 */
function renderLayout(entryType: string, query = '') {
	page.current = pageStub({
		params: { entryType, uuid: 'entity-1' },
		url: `http://localhost/trace/${entryType}/entity-1?${query}`
	});
	render(Layout, { children: result });
}

describe('trace layout', () => {
	test('should draw a cable trace with geometry on the map', () => {
		renderLayout('cable', 'include_geometry=true&geometry_mode=routed');

		expect(screen.getByText('trace result')).toBeInTheDocument();
		expect(screen.getByTestId('trace-map-panel')).toHaveAttribute('data-entry-type', 'cable');
	});

	test('should draw a node trace with geometry on the map', () => {
		renderLayout('node', 'include_geometry=true');

		expect(screen.getByTestId('trace-map-panel')).toHaveAttribute('data-entry-type', 'node');
	});

	test('should show no map for a trace without geometry', () => {
		renderLayout('cable');

		expect(screen.getByText('trace result')).toBeInTheDocument();
		expect(screen.queryByTestId('trace-map-panel')).not.toBeInTheDocument();
	});

	test('should draw a fiber’s signal analysis on the map', () => {
		renderLayout('fiber', 'mode=signal');

		expect(screen.getByTestId('trace-map-panel')).toHaveAttribute('data-entry-type', 'fiber');
	});
});
