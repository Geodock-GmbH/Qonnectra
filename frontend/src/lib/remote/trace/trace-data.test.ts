import { describe, expect, test } from 'vitest';

import {
	fiberTracePath,
	mapTraceSearchResults,
	signalAnalysisPath,
	traceSearchPath
} from './trace-data';

describe('fiberTracePath', () => {
	test('should name the entry by its type-specific id parameter', () => {
		const geometry = {
			includeGeometry: false,
			geometryMode: 'segments',
			orientGeometry: false
		} as const;

		expect(fiberTracePath({ entryType: 'address', entryId: 'a-1', ...geometry })).toBe(
			'fiber-trace/?address_id=a-1&include_geometry=false'
		);
		expect(fiberTracePath({ entryType: 'residential_unit', entryId: 'ru-1', ...geometry })).toBe(
			'fiber-trace/?residential_unit_id=ru-1&include_geometry=false'
		);
		expect(fiberTracePath({ entryType: 'fiber', entryId: 'f-1', ...geometry })).toBe(
			'fiber-trace/?fiber_id=f-1&include_geometry=false'
		);
	});

	test('should send the geometry options only when geometry is included', () => {
		expect(
			fiberTracePath({
				entryType: 'cable',
				entryId: 'c-1',
				includeGeometry: true,
				geometryMode: 'merged',
				orientGeometry: true
			})
		).toBe(
			'fiber-trace/?cable_id=c-1&include_geometry=true&geometry_mode=merged&orient_geometry=true'
		);

		expect(
			fiberTracePath({
				entryType: 'node',
				entryId: 'n-1',
				includeGeometry: false,
				geometryMode: 'merged',
				orientGeometry: true
			})
		).toBe('fiber-trace/?node_id=n-1&include_geometry=false');
	});
});

describe('signalAnalysisPath', () => {
	test('should always ask for routed geometry', () => {
		expect(signalAnalysisPath({ fiberId: 'f-1', signalSource: null, orientGeometry: false })).toBe(
			'signal-analysis/?fiber_id=f-1&include_geometry=true&geometry_mode=routed&orient_geometry=false'
		);
	});

	test('should name the signal source when one is picked', () => {
		expect(
			signalAnalysisPath({ fiberId: 'f-1', signalSource: 'node-abc', orientGeometry: true })
		).toBe(
			'signal-analysis/?fiber_id=f-1&include_geometry=true&signal_source_node_id=node-abc&geometry_mode=routed&orient_geometry=true'
		);
	});
});

describe('traceSearchPath', () => {
	test('should scope the search to a project', () => {
		expect(traceSearchPath({ searchQuery: 'Süder', type: 'address', projectId: '7' })).toBe(
			'trace-search/?search=S%C3%BCder&type=address&project=7'
		);
	});

	test('should search every project when none is given', () => {
		expect(traceSearchPath({ searchQuery: 'POP', type: 'node', projectId: '' })).toBe(
			'trace-search/?search=POP&type=node'
		);
	});
});

describe('mapTraceSearchResults', () => {
	test('should keep the hits that can be selected', () => {
		const payload = { results: [{ uuid: 'n-1', name: 'POP 1' }, { name: 'no uuid' }] };

		expect(mapTraceSearchResults(payload)).toEqual([{ uuid: 'n-1', name: 'POP 1' }]);
	});

	test('should return no hits for an unusable payload', () => {
		expect(mapTraceSearchResults(null)).toEqual([]);
		expect(mapTraceSearchResults({ results: 'nope' })).toEqual([]);
	});
});
