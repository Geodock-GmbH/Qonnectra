import type { HighlightedMap } from './areaHighlight';
import type { ValuationArea } from '$lib/remote/valuation/valuation-data';
import type BaseLayer from 'ol/layer/Base.js';
import { get as getProjection } from 'ol/proj.js';
import { describe, expect, test, vi } from 'vitest';

import { AreaHighlight } from './areaHighlight';

const UTM32 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

function createMap(projection = 'EPSG:3857') {
	const layers: BaseLayer[] = [];
	const map: HighlightedMap = {
		addLayer: vi.fn((layer: BaseLayer) => layers.push(layer)),
		removeLayer: vi.fn((layer: BaseLayer) => layers.splice(layers.indexOf(layer), 1)),
		getView: () => ({ getProjection: () => getProjection(projection) ?? undefined })
	};
	return { map, layers };
}

function area(uuid: string, origin: number, withGeometry = true): ValuationArea {
	return {
		uuid,
		name: uuid,
		areaType: null,
		geometry: withGeometry
			? {
					type: 'Polygon',
					coordinates: [
						[
							[origin, origin],
							[origin + 10, origin],
							[origin + 10, origin + 10],
							[origin, origin]
						]
					]
				}
			: null
	};
}

describe('AreaHighlight', () => {
	test('should add its layer to the map and remove it again', () => {
		const { map, layers } = createMap();
		const highlight = new AreaHighlight();

		highlight.attach(map, null);
		expect(layers).toHaveLength(1);

		highlight.detach();
		expect(layers).toHaveLength(0);
	});

	test('should outline the shown areas', () => {
		const { map } = createMap();
		const highlight = new AreaHighlight();
		highlight.attach(map, null);

		highlight.show([area('a', 0), area('b', 100)]);

		expect(highlight.source.getFeatures()).toHaveLength(2);
	});

	test('should replace the previous outlines', () => {
		const { map } = createMap();
		const highlight = new AreaHighlight();
		highlight.attach(map, null);

		highlight.show([area('a', 0), area('b', 100)]);
		highlight.show([area('b', 100)]);

		expect(highlight.source.getFeatures()).toHaveLength(1);

		highlight.show([]);
		expect(highlight.source.getFeatures()).toHaveLength(0);
	});

	test('should skip areas without a geometry', () => {
		const { map } = createMap();
		const highlight = new AreaHighlight();
		highlight.attach(map, null);

		highlight.show([area('a', 0, false), area('b', 100)]);

		expect(highlight.source.getFeatures()).toHaveLength(1);
	});

	test('should draw areas that were shown before the map was ready', () => {
		const { map } = createMap();
		const highlight = new AreaHighlight();

		highlight.show([area('a', 0)]);
		expect(highlight.source.getFeatures()).toHaveLength(0);

		highlight.attach(map, null);
		expect(highlight.source.getFeatures()).toHaveLength(1);
	});

	test('should reproject the outlines from the storage projection to the view', () => {
		const { map } = createMap('EPSG:3857');
		const highlight = new AreaHighlight();
		highlight.attach(map, { srid: 25832, proj4Def: UTM32 });

		highlight.show([area('a', 500000)]);

		const extent = highlight.source.getFeatures()[0].getGeometry()?.getExtent();
		expect(extent?.[0]).not.toBeCloseTo(500000, 0);
		expect(extent?.[0]).toBeGreaterThan(900000);
	});
});
