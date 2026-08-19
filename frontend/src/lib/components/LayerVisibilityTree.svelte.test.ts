import { get } from 'svelte/store';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	basemapTheme,
	layerTreeExpanded,
	layerVisibilityConfig,
	nodeTypeStyles
} from '$lib/stores/store';

import LayerVisibilityTree from './LayerVisibilityTree.svelte';

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

class FakeLayer {
	values: Record<string, unknown>;
	visible = true;
	setVisible = vi.fn((next: boolean) => {
		this.visible = next;
	});
	get(key: string) {
		return this.values[key];
	}
	constructor(values: Record<string, unknown>) {
		this.values = values;
	}
}

function makeLayers() {
	return {
		trenchLayer: new FakeLayer({ layerId: 'trench-layer', layerName: 'Gräben' }),
		nodeLayer: new FakeLayer({ layerId: 'node-layer', layerName: 'Knoten' })
	};
}

beforeEach(() => {
	localStorage.clear();
	layerVisibilityConfig.set({
		'address-layer': true,
		'node-layer': true,
		'trench-layer': true,
		'area-layer': true,
		'osm-base-layer': true
	});
	nodeTypeStyles.set({});
	basemapTheme.set('light');
	layerTreeExpanded.set(true);
});

describe('LayerVisibilityTree', () => {
	test('should list feature layers plus the OSM base layer', () => {
		const { trenchLayer, nodeLayer } = makeLayers();

		render(LayerVisibilityTree, { layers: [trenchLayer, nodeLayer] as never });

		expect(screen.getByText('Gräben')).toBeInTheDocument();
		expect(screen.getByText('Knoten')).toBeInTheDocument();
		expect(screen.getByText('common_osm')).toBeInTheDocument();
	});

	test('should apply persisted visibility to the layers on mount', () => {
		layerVisibilityConfig.set({ 'trench-layer': false } as never);
		const { trenchLayer } = makeLayers();

		render(LayerVisibilityTree, { layers: [trenchLayer] as never });

		expect(trenchLayer.setVisible).toHaveBeenCalledWith(false);
	});

	test('should toggle a layer, persist it, and notify the parent', async () => {
		const user = userEvent.setup();
		const onLayerVisibilityChanged = vi.fn();
		const { trenchLayer } = makeLayers();

		render(LayerVisibilityTree, {
			layers: [trenchLayer] as never,
			onLayerVisibilityChanged
		});

		const trenchRow = screen.getByText('Gräben').closest('div[class*="rounded"]')
			?.parentElement as HTMLElement;
		const hideButtons = within(trenchRow).getAllByRole('button', {
			name: 'tooltip_hide_layer'
		});
		await user.click(hideButtons[0]);

		expect(trenchLayer.setVisible).toHaveBeenCalledWith(false);
		expect(get(layerVisibilityConfig)['trench-layer']).toBe(false);
		expect(onLayerVisibilityChanged).toHaveBeenCalledWith(
			expect.objectContaining({ layerId: 'trench-layer', visible: false })
		);
	});

	test('should seed default node type styles for new node types', () => {
		render(LayerVisibilityTree, {
			layers: [],
			nodeTypes: [{ node_type: 'POP' }, { node_type: 'Muffe' }] as never
		});

		const styles = get(nodeTypeStyles);
		expect(styles.POP).toMatchObject({ visible: true, size: 22 });
		expect(styles.Muffe).toMatchObject({ visible: true, size: 12 });
	});

	test('should toggle the basemap theme', async () => {
		const user = userEvent.setup();
		render(LayerVisibilityTree, { layers: [] });

		const themeToggle = screen.getAllByRole('button', {
			name: 'tooltip_switch_to_dark_theme'
		})[0];
		await user.click(themeToggle);

		expect(get(basemapTheme)).toBe('dark');
	});

	test('should render WMS sources with their layers', () => {
		const areaLayer = new FakeLayer({ layerId: 'area-layer', layerName: 'Flächen' });

		render(LayerVisibilityTree, {
			layers: [areaLayer] as never,
			projectId: '7',
			wmsSources: [
				{
					id: 'src-1',
					name: 'DOP',
					layers: [
						{
							id: 'l1',
							name: 'dop20',
							title: 'Orthophotos',
							is_enabled: true,
							sort_order: 1,
							min_zoom: 8,
							max_zoom: null,
							opacity: 1
						}
					]
				}
			] as never
		});

		expect(screen.getByText('DOP')).toBeInTheDocument();
	});
});
