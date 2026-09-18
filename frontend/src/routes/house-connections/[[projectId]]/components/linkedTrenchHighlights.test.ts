import type BaseLayer from 'ol/layer/Base.js';
import Feature from 'ol/Feature.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import { describe, expect, test, vi } from 'vitest';

import { LinkedTrenchHighlights } from './linkedTrenchHighlights';

function createMap() {
	const layers: VectorTileLayer[] = [];
	const map = {
		addLayer: (layer: BaseLayer) => {
			if (layer instanceof VectorTileLayer) layers.push(layer);
		},
		removeLayer: (layer: BaseLayer) => layers.splice(layers.indexOf(layer as VectorTileLayer), 1)[0]
	};
	return { map, layers };
}

function trench(id: string | undefined): Feature {
	const feature = new Feature();
	if (id) feature.setId(id);
	return feature;
}

function styleOf(layer: VectorTileLayer, feature: Feature) {
	const styleFunction = layer.getStyleFunction();
	return styleFunction?.(feature, 1);
}

describe('LinkedTrenchHighlights', () => {
	test('should add a highlight layer that styles nothing at first', () => {
		const { map, layers } = createMap();
		const highlights = new LinkedTrenchHighlights();

		highlights.attach(map, null);

		expect(layers).toHaveLength(1);
		expect(layers[0].get('isHighlightLayer')).toBe(true);
		expect(styleOf(layers[0], trench('trench-1'))).toBeUndefined();
	});

	test('should style only the trenches of the shown conduits', () => {
		const { map, layers } = createMap();
		const highlights = new LinkedTrenchHighlights();
		highlights.attach(map, null);

		highlights.show('conduit-1', ['trench-1', 'trench-2']);

		expect(styleOf(layers[0], trench('trench-1'))).toBeDefined();
		expect(styleOf(layers[0], trench('trench-3'))).toBeUndefined();
		expect(styleOf(layers[0], trench(undefined))).toBeUndefined();
	});

	test('should redraw the layer whenever the highlights change', () => {
		const { map, layers } = createMap();
		const highlights = new LinkedTrenchHighlights();
		highlights.attach(map, null);
		const changed = vi.spyOn(layers[0], 'changed');

		highlights.show('conduit-1', ['trench-1']);
		highlights.hide('conduit-1');

		expect(changed).toHaveBeenCalledTimes(2);
	});

	test('should keep a trench highlighted while another shown conduit uses it', () => {
		const highlights = new LinkedTrenchHighlights();
		highlights.show('conduit-1', ['trench-1', 'trench-2']);
		highlights.show('conduit-2', ['trench-2', 'trench-3']);

		highlights.hide('conduit-1');

		expect(highlights.isHighlighted('trench-1')).toBe(false);
		expect(highlights.isHighlighted('trench-2')).toBe(true);
		expect(highlights.isHighlighted('trench-3')).toBe(true);
	});

	test('should drop every highlight on clear', () => {
		const highlights = new LinkedTrenchHighlights();
		highlights.show('conduit-1', ['trench-1']);
		highlights.show('conduit-2', ['trench-2']);

		highlights.clear();

		expect(highlights.isHighlighted('trench-1')).toBe(false);
		expect(highlights.isHighlighted('trench-2')).toBe(false);
	});

	test('should collect highlights before the map is ready', () => {
		const { map, layers } = createMap();
		const highlights = new LinkedTrenchHighlights();

		highlights.show('conduit-1', ['trench-1']);
		highlights.attach(map, null);

		expect(styleOf(layers[0], trench('trench-1'))).toBeDefined();
	});

	test('should remove its layer and forget the highlights on detach', () => {
		const { map, layers } = createMap();
		const highlights = new LinkedTrenchHighlights();
		highlights.attach(map, null);
		highlights.show('conduit-1', ['trench-1']);

		highlights.detach();

		expect(layers).toHaveLength(0);
		expect(highlights.isHighlighted('trench-1')).toBe(false);
	});
});
