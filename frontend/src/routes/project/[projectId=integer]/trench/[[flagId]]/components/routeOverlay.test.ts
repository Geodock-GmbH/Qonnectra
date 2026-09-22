import type BaseLayer from 'ol/layer/Base.js';
import VectorLayer from 'ol/layer/Vector.js';
import { describe, expect, test } from 'vitest';

import { RouteOverlay } from './routeOverlay';

function createMap() {
	const layers: BaseLayer[] = [];
	const map = {
		addLayer: (layer: BaseLayer) => {
			layers.push(layer);
		},
		removeLayer: (layer: BaseLayer) => layers.splice(layers.indexOf(layer), 1)[0],
		getView: () => ({ getProjection: () => 'EPSG:3857' })
	};
	return { map, layers };
}

function featureCount(layer: BaseLayer): number {
	return (layer as VectorLayer).getSource()?.getFeatures().length ?? 0;
}

describe('RouteOverlay', () => {
	test('should add a route layer and a highlight layer, both excluded from selection', () => {
		const { map, layers } = createMap();
		const overlay = new RouteOverlay();

		overlay.attach(map);

		expect(layers).toHaveLength(2);
		expect(layers.every((layer) => layer.get('isHighlightLayer') === true)).toBe(true);
		expect(overlay.highlightLayer).toBe(layers[1]);
	});

	test('should draw a route from its WKT', () => {
		const { map, layers } = createMap();
		const overlay = new RouteOverlay();
		overlay.attach(map);

		overlay.showRoute('LINESTRING(0 0, 10 10)', 'EPSG:3857');

		expect(featureCount(layers[0])).toBe(1);
	});

	test('should replace the previous route', () => {
		const { map, layers } = createMap();
		const overlay = new RouteOverlay();
		overlay.attach(map);
		overlay.showRoute('LINESTRING(0 0, 10 10)', 'EPSG:3857');

		overlay.showRoute('LINESTRING(5 5, 20 20)', 'EPSG:3857');

		expect(featureCount(layers[0])).toBe(1);
	});

	test('should clear the route', () => {
		const { map, layers } = createMap();
		const overlay = new RouteOverlay();
		overlay.attach(map);
		overlay.showRoute('LINESTRING(0 0, 10 10)', 'EPSG:3857');

		overlay.clear();

		expect(featureCount(layers[0])).toBe(0);
	});

	test('should ignore a route before the map is ready', () => {
		const overlay = new RouteOverlay();

		expect(() => overlay.showRoute('LINESTRING(0 0, 10 10)', 'EPSG:3857')).not.toThrow();
		expect(overlay.highlightLayer).toBeUndefined();
	});

	test('should remove both layers on detach', () => {
		const { map, layers } = createMap();
		const overlay = new RouteOverlay();
		overlay.attach(map);

		overlay.detach();

		expect(layers).toHaveLength(0);
		expect(overlay.highlightLayer).toBeUndefined();
	});
});
