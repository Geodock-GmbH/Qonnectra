import { describe, it, expect } from 'vitest';
import { buildGeoJSON, hasGeometries } from './traceUtils.js';

const POINT_GEOM = { type: 'Point', coordinates: [550000, 6080000] };
const LINE_GEOM = { type: 'LineString', coordinates: [[550000, 6080000], [550100, 6080100]] };

/**
 * Builds a minimal trace tree node for testing.
 * @param {Record<string, any>} overrides - Fields to override
 * @returns {Record<string, any>} Trace tree node
 */
function makeTraceTree(overrides = {}) {
	return {
		fiber: {
			id: 'fiber-1',
			cable_name: 'Cable-1',
			fiber_number_absolute: 1,
			cable_endpoints: {}
		},
		node: null,
		children: [],
		...overrides
	};
}

describe('buildGeoJSON', () => {
	it('includes trench LineString features with feature_type property', () => {
		const result = {
			cable_infrastructure: {
				'cable-1': {
					trenches: [{ id: 't1', id_trench: 'T1', geometry: LINE_GEOM, length: 100 }]
				}
			}
		};
		const geojson = buildGeoJSON(result);
		expect(geojson.features).toHaveLength(1);
		expect(geojson.features[0].properties.feature_type).toBe('trench');
		expect(geojson.features[0].geometry.type).toBe('LineString');
	});

	it('includes merged cable features with feature_type property', () => {
		const result = {
			cable_infrastructure: {
				'cable-1': { merged_geometry: LINE_GEOM, total_length: 200 }
			}
		};
		const geojson = buildGeoJSON(result);
		expect(geojson.features).toHaveLength(1);
		expect(geojson.features[0].properties.feature_type).toBe('cable');
	});

	it('extracts node Point features from trace_tree', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				children: [
					{
						fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
						node: { id: 'node-1', name: 'Node-1', geometry: POINT_GEOM },
						children: []
					}
				]
			})
		};
		const geojson = buildGeoJSON(result);
		const nodeFeatures = geojson.features.filter((/** @type {any} */ f) => f.properties.feature_type === 'node');
		expect(nodeFeatures).toHaveLength(1);
		expect(nodeFeatures[0].properties.name).toBe('Node-1');
		expect(nodeFeatures[0].properties.id).toBe('node-1');
		expect(nodeFeatures[0].geometry.type).toBe('Point');
	});

	it('extracts address Point features from trace_tree', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				children: [
					{
						fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
						node: {
							id: 'node-1',
							name: 'Node-1',
							geometry: POINT_GEOM,
							address: {
								id: 'addr-1',
								street: 'Teststraße',
								housenumber: 42,
								suffix: '',
								zip_code: '24941',
								city: 'Flensburg',
								geometry: POINT_GEOM
							}
						},
						children: []
					}
				]
			})
		};
		const geojson = buildGeoJSON(result);
		const addrFeatures = geojson.features.filter(
			(/** @type {any} */ f) => f.properties.feature_type === 'address'
		);
		expect(addrFeatures).toHaveLength(1);
		expect(addrFeatures[0].properties.street).toBe('Teststraße');
		expect(addrFeatures[0].properties.id).toBe('addr-1');
	});

	it('deduplicates point features by id', () => {
		const nodeWithGeom = {
			id: 'node-1',
			name: 'Node-1',
			geometry: POINT_GEOM
		};
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				children: [
					{
						fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
						node: nodeWithGeom,
						children: [
							{
								fiber: {
									id: 'fiber-3',
									cable_name: 'Cable-3',
									cable_endpoints: {}
								},
								node: nodeWithGeom,
								children: []
							}
						]
					}
				]
			})
		};
		const geojson = buildGeoJSON(result);
		const nodeFeatures = geojson.features.filter((/** @type {any} */ f) => f.properties.feature_type === 'node');
		expect(nodeFeatures).toHaveLength(1);
	});

	it('handles trace_trees array (cable/node/address traces)', () => {
		const result = {
			cable_infrastructure: {},
			trace_trees: [
				makeTraceTree({
					children: [
						{
							fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
							node: { id: 'node-1', name: 'Node-1', geometry: POINT_GEOM },
							children: []
						}
					]
				}),
				makeTraceTree({
					children: [
						{
							fiber: { id: 'fiber-3', cable_name: 'Cable-3', cable_endpoints: {} },
							node: { id: 'node-2', name: 'Node-2', geometry: POINT_GEOM },
							children: []
						}
					]
				})
			]
		};
		const geojson = buildGeoJSON(result);
		const nodeFeatures = geojson.features.filter((/** @type {any} */ f) => f.properties.feature_type === 'node');
		expect(nodeFeatures).toHaveLength(2);
	});

	it('extracts cable endpoint nodes with geometry', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				cable_endpoints: {
					start_node: { id: 'node-start', name: 'Start', geometry: POINT_GEOM },
					end_node: {
						id: 'node-end',
						name: 'End',
						geometry: POINT_GEOM,
						address: {
							id: 'addr-end',
							street: 'Endstraße',
							housenumber: 1,
							suffix: '',
							zip_code: '12345',
							city: 'Berlin',
							geometry: POINT_GEOM
						}
					}
				}
			})
		};
		const geojson = buildGeoJSON(result);
		const nodeFeatures = geojson.features.filter(
			(/** @type {any} */ f) => f.properties.feature_type === 'node'
		);
		const addrFeatures = geojson.features.filter(
			(/** @type {any} */ f) => f.properties.feature_type === 'address'
		);
		expect(nodeFeatures).toHaveLength(2);
		expect(addrFeatures).toHaveLength(1);
		expect(addrFeatures[0].properties.street).toBe('Endstraße');
	});

	it('deduplicates cable endpoint nodes with splice nodes', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				children: [
					{
						fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
						node: { id: 'node-1', name: 'Node-1', geometry: POINT_GEOM },
						cable_endpoints: {
							start_node: { id: 'node-1', name: 'Node-1', geometry: POINT_GEOM }
						},
						children: []
					}
				]
			})
		};
		const geojson = buildGeoJSON(result);
		const nodeFeatures = geojson.features.filter(
			(/** @type {any} */ f) => f.properties.feature_type === 'node'
		);
		expect(nodeFeatures).toHaveLength(1);
	});

	it('skips nodes without geometry', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				children: [
					{
						fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
						node: { id: 'node-1', name: 'Node-1' },
						children: []
					}
				]
			})
		};
		const geojson = buildGeoJSON(result);
		const nodeFeatures = geojson.features.filter((/** @type {any} */ f) => f.properties.feature_type === 'node');
		expect(nodeFeatures).toHaveLength(0);
	});
});

describe('hasGeometries', () => {
	it('returns true when only point geometries exist', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({
				children: [
					{
						fiber: { id: 'fiber-2', cable_name: 'Cable-2', cable_endpoints: {} },
						node: { id: 'node-1', name: 'Node-1', geometry: POINT_GEOM },
						children: []
					}
				]
			})
		};
		expect(hasGeometries(result)).toBe(true);
	});

	it('returns true when trench geometries exist', () => {
		const result = {
			cable_infrastructure: {
				'cable-1': { trenches: [{ geometry: LINE_GEOM }] }
			}
		};
		expect(hasGeometries(result)).toBe(true);
	});

	it('returns false when no geometries exist at all', () => {
		const result = {
			cable_infrastructure: {},
			trace_tree: makeTraceTree({ children: [] })
		};
		expect(hasGeometries(result)).toBe(false);
	});

	it('returns false for null/undefined result', () => {
		expect(hasGeometries(/** @type {any} */ (null))).toBe(false);
		expect(hasGeometries(/** @type {any} */ (undefined))).toBe(false);
	});
});
