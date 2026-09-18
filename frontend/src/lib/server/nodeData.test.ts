import { describe, expect, test } from 'vitest';

import { mapNodesToOptions } from './nodeData';

describe('mapNodesToOptions', () => {
	test('maps GeoJSON features using id and properties.name', () => {
		const result = mapNodesToOptions({
			features: [
				{ id: 'feat-1', properties: { name: 'Node One' } },
				{ id: 'feat-2', properties: { name: 'Node Two' } }
			]
		});

		expect(result).toEqual([
			{ value: 'feat-1', label: 'Node One' },
			{ value: 'feat-2', label: 'Node Two' }
		]);
	});

	test('maps the nodes array using uuid fallback for value', () => {
		const result = mapNodesToOptions({
			nodes: [{ uuid: 'node-uuid-1', name: 'Alpha' }]
		});

		expect(result).toEqual([{ value: 'node-uuid-1', label: 'Alpha' }]);
	});

	test('maps a flat array and falls back to "Unnamed Node"', () => {
		const result = mapNodesToOptions([{ uuid: 'flat-1' }]);

		expect(result).toEqual([{ value: 'flat-1', label: 'Unnamed Node' }]);
	});

	test('returns an empty array for null input', () => {
		expect(mapNodesToOptions(null)).toEqual([]);
	});
});
