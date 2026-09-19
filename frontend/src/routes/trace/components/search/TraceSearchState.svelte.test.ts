import { describe, expect, test } from 'vitest';

import { TraceSearchState } from './TraceSearchState.svelte';

describe('TraceSearchState', () => {
	test('should search cables while a fiber is being picked', () => {
		const search = new TraceSearchState();
		expect(search.searchType).toBe('address');

		search.setActiveType('fiber');

		expect(search.searchType).toBe('cable');
	});

	test('should drop the picked cable when the entry type changes', () => {
		const search = new TraceSearchState();
		search.setActiveType('fiber');
		search.selectedCable = { uuid: 'c-1', name: 'Cable 1' };

		search.setActiveType('node');

		expect(search.selectedCable).toBeNull();
	});

	test('should address a trace without geometry by its plain path', () => {
		expect(new TraceSearchState().tracePath('residential_unit', 'ru-1')).toBe(
			'/trace/residential-unit/ru-1'
		);
	});

	test('should carry the geometry options in the query string', () => {
		const search = new TraceSearchState();
		search.includeGeometry = true;
		search.geometryMode = 'merged';

		expect(search.tracePath('fiber', 'f-1')).toBe(
			'/trace/fiber/f-1?include_geometry=true&geometry_mode=merged'
		);

		search.orientGeometry = true;

		expect(search.tracePath('fiber', 'f-1')).toBe(
			'/trace/fiber/f-1?include_geometry=true&geometry_mode=merged&orient_geometry=true'
		);
	});

	test('should ignore the geometry mode and orientation while geometry is off', () => {
		const search = new TraceSearchState();
		search.geometryMode = 'routed';
		search.orientGeometry = true;

		expect(search.tracePath('cable', 'c-1')).toBe('/trace/cable/c-1');
	});
});
