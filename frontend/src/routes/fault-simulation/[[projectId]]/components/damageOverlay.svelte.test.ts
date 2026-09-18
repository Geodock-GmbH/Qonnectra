import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import type BaseLayer from 'ol/layer/Base.js';
import type OlMap from 'ol/Map.js';
import { get as getProjection } from 'ol/proj.js';
import { describe, expect, test, vi } from 'vitest';

import { DamageOverlay } from './damageOverlay';

const UTM32 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

function createMap(projection = 'EPSG:3857') {
	const layers: BaseLayer[] = [];
	const map = {
		addLayer: vi.fn((layer: BaseLayer) => layers.push(layer)),
		removeLayer: vi.fn((layer: BaseLayer) => layers.splice(layers.indexOf(layer), 1)),
		getView: () => ({ getProjection: () => getProjection(projection) })
	};
	return { map: map as unknown as OlMap, layers };
}

function resultWith(geometry: FaultSimulationResult['geometry']): FaultSimulationResult {
	return { trench: null, conduits: [], cables: [], affected_addresses_details: [], geometry };
}

function pointCollection(x: number, y: number, properties: Record<string, unknown> = {}) {
	return {
		type: 'FeatureCollection' as const,
		features: [{ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [x, y] } }]
	};
}

function lineCollection(...coordinates: number[][]) {
	return {
		type: 'FeatureCollection' as const,
		features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }]
	};
}

describe('DamageOverlay', () => {
	test('should add its four layers to the map and remove them again', () => {
		const { map, layers } = createMap();
		const overlay = new DamageOverlay();

		overlay.attach(map, null);
		expect(layers).toHaveLength(4);

		overlay.detach();
		expect(layers).toHaveLength(0);
	});

	test('should draw affected trenches, nodes and addresses of a result', () => {
		const { map } = createMap();
		const overlay = new DamageOverlay();
		overlay.attach(map, null);

		overlay.showResult(
			resultWith({
				affected_trenches: lineCollection([0, 0], [5, 5]),
				affected_nodes: pointCollection(1, 1, { has_address: true }),
				affected_addresses: pointCollection(2, 2)
			})
		);

		expect(overlay.affectedTrenchSource.getFeatures()).toHaveLength(1);
		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(1);
		expect(overlay.affectedAddressSource.getFeatures()).toHaveLength(1);
	});

	test('should reproject result geometries from the storage projection', () => {
		const { map } = createMap('EPSG:3857');
		const overlay = new DamageOverlay();
		overlay.attach(map, { srid: 25832, proj4Def: UTM32 });

		overlay.showResult(resultWith({ affected_nodes: pointCollection(500000, 5761038) }));

		const [x, y] = overlay.affectedNodeSource.getFeatures()[0].getGeometry()?.getExtent() ?? [];
		expect(x).toBeCloseTo(1001875.4, 0);
		expect(y).toBeGreaterThan(6_700_000);
		expect(y).toBeLessThan(6_900_000);
	});

	test('should replace a previous result instead of accumulating features', () => {
		const { map } = createMap();
		const overlay = new DamageOverlay();
		overlay.attach(map, null);

		overlay.showResult(resultWith({ affected_nodes: pointCollection(1, 1) }));
		overlay.showResult(resultWith({ affected_addresses: pointCollection(2, 2) }));

		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(0);
		expect(overlay.affectedAddressSource.getFeatures()).toHaveLength(1);
	});

	test('should drop the drawn result when a new damage point is marked', () => {
		const { map } = createMap();
		const overlay = new DamageOverlay();
		overlay.attach(map, null);
		overlay.showResult(resultWith({ affected_nodes: pointCollection(1, 1) }));

		overlay.showDamagePoint([3, 4]);

		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(0);
		expect(overlay.damagePointSource.getFeatures()).toHaveLength(1);
	});

	test('should draw a result that arrived before the map once the map attaches', () => {
		const { map } = createMap();
		const overlay = new DamageOverlay();

		overlay.showResult(resultWith({ affected_nodes: pointCollection(1, 1) }));
		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(0);

		overlay.attach(map, null);
		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(1);
	});

	test('should not redraw a cleared result when the map attaches', () => {
		const { map } = createMap();
		const overlay = new DamageOverlay();
		overlay.showResult(resultWith({ affected_nodes: pointCollection(1, 1) }));
		overlay.clear();

		overlay.attach(map, null);

		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(0);
	});

	test('should clear the damage point and the result', () => {
		const { map } = createMap();
		const overlay = new DamageOverlay();
		overlay.attach(map, null);
		overlay.showDamagePoint([3, 4]);
		overlay.showResult(resultWith({ affected_nodes: pointCollection(1, 1) }));

		overlay.clear();

		expect(overlay.damagePointSource.getFeatures()).toHaveLength(0);
		expect(overlay.affectedNodeSource.getFeatures()).toHaveLength(0);
	});
});
