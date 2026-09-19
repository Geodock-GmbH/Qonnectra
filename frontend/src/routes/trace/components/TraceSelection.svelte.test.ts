import { describe, expect, test } from 'vitest';

import { TraceSelection } from './TraceSelection.svelte';

describe('TraceSelection', () => {
	test('should start without a highlighted entity', () => {
		expect(new TraceSelection().featureId).toBeNull();
	});

	test('should highlight a list item under the map’s feature id', () => {
		const selection = new TraceSelection();

		selection.selectItem('cable', 'c-1');

		expect(selection.featureId).toBe('cable:c-1');
	});

	test('should follow the map and clear on a click beside every feature', () => {
		const selection = new TraceSelection();

		selection.selectFeature('node:n-1');
		expect(selection.featureId).toBe('node:n-1');

		selection.selectFeature(null);
		expect(selection.featureId).toBeNull();
	});
});
