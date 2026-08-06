import type { MapPopupManager } from './MapPopupManager.svelte';
import type { MapSelectionManager } from './MapSelectionManager.svelte';
import type { DrawerStore } from '$lib/stores/drawer';
import type { Feature } from 'ol';
import type OlMap from 'ol/Map';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { MapInteractionManager } from './MapInteractionManager.svelte';

class FakeLayer {
	get = () => undefined;
}

class FakeSelectionManager {
	selectFeature = vi.fn();
	clearSelection = vi.fn();
}

class FakePopupManager {
	show = vi.fn();
	hide = vi.fn();
}

class FakeDrawerStore {
	open = vi.fn();
	close = vi.fn();
}

class FakeMap {
	listeners: Record<string, (event: unknown) => void> = {};
	features: Array<{ feature: unknown; layer: unknown }> = [];
	on = vi.fn((type: string, listener: (event: unknown) => void) => {
		this.listeners[type] = listener;
	});
	forEachFeatureAtPixel = vi.fn(
		(
			_pixel: number[],
			callback: (feature: unknown, layer: unknown) => void,
			options: { layerFilter: (layer: unknown) => boolean }
		) => {
			this.features
				.filter(({ layer }) => options.layerFilter(layer))
				.forEach(({ feature, layer }) => callback(feature, layer));
		}
	);
}

const drawerComponent = (() => {}) as never;

function makeFeature(id: string | undefined, properties: Record<string, unknown> = {}): Feature {
	return {
		getId: () => id,
		getProperties: () => ({ ...properties }),
		get: (key: string) => properties[key]
	} as unknown as Feature;
}

function setup(configOverrides: Record<string, boolean> | null = null) {
	const selectionManager = new FakeSelectionManager();
	const popupManager = new FakePopupManager();
	const drawerStore = new FakeDrawerStore();
	const manager = new MapInteractionManager(
		selectionManager as unknown as MapSelectionManager,
		popupManager as unknown as MapPopupManager,
		drawerStore as unknown as DrawerStore,
		drawerComponent,
		{ name: 'Name' },
		configOverrides as never
	);
	const map = new FakeMap();
	const layers = {
		vectorTileLayer: new FakeLayer() as never,
		addressLayer: new FakeLayer() as never,
		nodeLayer: new FakeLayer() as never,
		areaLayer: new FakeLayer() as never
	};
	return { manager, selectionManager, popupManager, drawerStore, map, layers };
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('initialize', () => {
	test('should register a click listener on the map', () => {
		const { manager, map, layers } = setup();

		expect(manager.initialize(map as unknown as OlMap, layers)).toBe(true);
		expect(map.on).toHaveBeenCalledWith('click', expect.any(Function));
	});

	test('should fail without a map', () => {
		const { manager } = setup();

		expect(manager.initialize(null as unknown as OlMap, {})).toBe(false);
	});
});

describe('getClickedFeatures', () => {
	test('should only query layers enabled in the selectable config', () => {
		const { manager, map, layers } = setup({
			trench: true,
			address: false,
			node: false,
			area: false
		});
		manager.initialize(map as unknown as OlMap, layers);
		map.features = [
			{ feature: makeFeature('t1'), layer: layers.vectorTileLayer },
			{ feature: makeFeature('a1'), layer: layers.addressLayer }
		];

		const clicked = manager.getClickedFeatures([0, 0]);

		expect(clicked).toHaveLength(1);
		expect((clicked[0].feature as Feature).getId()).toBe('t1');
	});

	test('should return nothing when no layers are selectable', () => {
		const { manager, map, layers } = setup({
			trench: false,
			address: false,
			node: false,
			area: false
		});
		manager.initialize(map as unknown as OlMap, layers);

		expect(manager.getClickedFeatures([0, 0])).toEqual([]);
		expect(map.forEachFeatureAtPixel).not.toHaveBeenCalled();
	});
});

describe('isLayerSelectable', () => {
	test('should reflect the per-layer configuration', () => {
		const { manager, map, layers } = setup({
			trench: true,
			address: false,
			node: true,
			area: false
		});
		manager.initialize(map as unknown as OlMap, layers);

		expect(manager.isLayerSelectable(layers.vectorTileLayer)).toBe(true);
		expect(manager.isLayerSelectable(layers.addressLayer)).toBe(false);
		expect(manager.isLayerSelectable(layers.nodeLayer)).toBe(true);
		expect(manager.isLayerSelectable(layers.areaLayer)).toBe(false);
		expect(manager.isLayerSelectable(new FakeLayer() as never)).toBe(false);
	});
});

describe('handleFeatureClick', () => {
	test('should select the feature and open the drawer with formatted props', () => {
		const { manager, selectionManager, drawerStore, map, layers } = setup();
		manager.initialize(map as unknown as OlMap, layers);
		const feature = makeFeature('t1', {
			id_trench: 'T-42',
			geometry: {},
			project: 7
		});

		manager.handleFeatureClick(feature, [10, 20], layers.vectorTileLayer);

		expect(selectionManager.selectFeature).toHaveBeenCalledWith('t1', feature);
		expect(drawerStore.open).toHaveBeenCalledWith({
			title: 'T-42',
			component: drawerComponent,
			props: expect.objectContaining({
				featureType: 'trench',
				featureId: 't1',
				featureData: { id_trench: 'T-42', project: 7 },
				alias: { name: 'Name' },
				featureProjectId: '7'
			})
		});
	});

	test('should fall back to the popup when the feature type is unknown', () => {
		const { manager, popupManager, drawerStore, map, layers } = setup();
		manager.initialize(map as unknown as OlMap, layers);
		const feature = makeFeature('x1', { something: 'else' });

		manager.handleFeatureClick(feature, [10, 20], null);

		expect(popupManager.show).toHaveBeenCalledWith([10, 20], feature);
		expect(drawerStore.open).not.toHaveBeenCalled();
	});

	test('should treat clicks on non-selectable layers as empty clicks', () => {
		const { manager, selectionManager, drawerStore, map, layers } = setup({
			trench: false,
			address: true,
			node: true,
			area: true
		});
		manager.initialize(map as unknown as OlMap, layers);

		manager.handleFeatureClick(makeFeature('t1'), [0, 0], layers.vectorTileLayer);

		expect(selectionManager.clearSelection).toHaveBeenCalled();
		expect(drawerStore.close).toHaveBeenCalled();
		expect(selectionManager.selectFeature).not.toHaveBeenCalled();
	});

	test('should treat features without an id as empty clicks', () => {
		const { manager, selectionManager, map, layers } = setup();
		manager.initialize(map as unknown as OlMap, layers);

		manager.handleFeatureClick(makeFeature(undefined), [0, 0], null);

		expect(selectionManager.clearSelection).toHaveBeenCalled();
	});
});

describe('handleMapClick', () => {
	test('should route the first clicked feature to handleFeatureClick', () => {
		const { manager, selectionManager, map, layers } = setup();
		manager.initialize(map as unknown as OlMap, layers);
		const feature = makeFeature('t1', { id_trench: 'T-1' });
		map.features = [{ feature, layer: layers.vectorTileLayer }];

		map.listeners.click({ pixel: [0, 0], coordinate: [1, 2] });

		expect(selectionManager.selectFeature).toHaveBeenCalledWith('t1', feature);
	});

	test('should clear everything when clicking empty space', () => {
		const { manager, selectionManager, popupManager, drawerStore, map, layers } = setup();
		manager.initialize(map as unknown as OlMap, layers);

		map.listeners.click({ pixel: [0, 0], coordinate: [1, 2] });

		expect(selectionManager.clearSelection).toHaveBeenCalled();
		expect(popupManager.hide).toHaveBeenCalled();
		expect(drawerStore.close).toHaveBeenCalled();
	});

	test('should clear the search highlight on every click', () => {
		const { manager, map, layers } = setup();
		const clear = vi.fn();
		const highlightLayer = { getSource: () => ({ clear }) } as never;
		manager.initialize(map as unknown as OlMap, layers, {
			getHighlightLayer: () => highlightLayer
		});

		map.listeners.click({ pixel: [0, 0], coordinate: [1, 2] });

		expect(clear).toHaveBeenCalled();
	});
});

describe('cleanup', () => {
	test('should drop map, layer, and search panel references', () => {
		const { manager, map, layers } = setup();
		manager.initialize(map as unknown as OlMap, layers, {});

		manager.cleanup();

		expect(manager.olMap).toBeNull();
		expect(manager.layers).toEqual({});
		expect(manager.searchPanelRef).toBeNull();
	});
});
