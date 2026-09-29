import type { TrenchProfileConduit } from '$lib/remote/map/trench-data';
import { describe, expect, test } from 'vitest';

import { gridPosition, nodePlacement, toProfileNodes } from './profileNodes';

const savedConduit: TrenchProfileConduit = {
	conduit_uuid: 'c1',
	conduit_name: 'DA 50',
	conduit_type: 'Rohr',
	microducts: [{ uuid: 'm1', color: 'rot' }],
	has_saved_position: true,
	canvas_x: 10,
	canvas_y: 20,
	canvas_width: 100,
	canvas_height: 60
};

const unsavedConduit: TrenchProfileConduit = {
	...savedConduit,
	has_saved_position: false,
	canvas_x: null,
	canvas_y: null,
	canvas_width: null,
	canvas_height: null
};

describe('toProfileNodes', () => {
	test('should place a conduit at its saved canvas position and size', () => {
		expect(toProfileNodes([savedConduit])).toEqual([
			{
				id: 'c1',
				type: 'trenchProfileNode',
				position: { x: 10, y: 20 },
				style: 'width: 100px; height: 60px;',
				selected: false,
				data: {
					conduit: {
						uuid: 'c1',
						conduit_name: 'DA 50',
						conduit_type: 'Rohr',
						microducts: [{ uuid: 'm1', color: 'rot' }]
					}
				}
			}
		]);
	});

	test('should fall back to grid positions for unsaved conduits', () => {
		const nodes = toProfileNodes([
			unsavedConduit,
			{ ...unsavedConduit, conduit_uuid: 'c2' },
			{ ...unsavedConduit, conduit_uuid: 'c3' },
			{ ...unsavedConduit, conduit_uuid: 'c4' }
		]);

		expect(nodes.map((n) => n.position)).toEqual([
			{ x: 0, y: 0 },
			{ x: 120, y: 0 },
			{ x: 0, y: 120 },
			{ x: 120, y: 120 }
		]);
		expect(nodes[0].style).toBe('width: 80px; height: 80px;');
	});

	test('should skip conduits without a uuid and handle empty input', () => {
		expect(toProfileNodes([])).toEqual([]);
		expect(toProfileNodes([{ ...savedConduit, conduit_uuid: '' }])).toEqual([]);
	});
});

describe('gridPosition', () => {
	test('should lay out conduits in a square grid', () => {
		expect(gridPosition(0, 9)).toEqual({ x: 0, y: 0 });
		expect(gridPosition(2, 9)).toEqual({ x: 240, y: 0 });
		expect(gridPosition(3, 9)).toEqual({ x: 0, y: 120 });
	});
});

describe('nodePlacement', () => {
	test('should prefer the measured size of a node', () => {
		expect(
			nodePlacement({
				id: 'c1',
				position: { x: 30, y: 40 },
				measured: { width: 90, height: 70 },
				width: 10,
				height: 10
			})
		).toEqual({ conduitUuid: 'c1', x: 30, y: 40, width: 90, height: 70 });
	});

	test('should fall back to the default size for an unmeasured node', () => {
		expect(nodePlacement({ id: 'c1', position: { x: 1, y: 2 } })).toEqual({
			conduitUuid: 'c1',
			x: 1,
			y: 2,
			width: 80,
			height: 80
		});
	});
});
