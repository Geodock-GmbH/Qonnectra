import type { NetworkSchemaState } from './NetworkSchemaState.svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { NetworkSchemaSearchManager } from './NetworkSchemaSearchManager.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_unnamed_node: () => 'Unbenannter Knoten',
		form_unnamed_cable: () => 'Unbenanntes Kabel'
	}
}));

function makeSchemaState(): NetworkSchemaState {
	return {
		nodes: [
			{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'PoP Nord' } },
			{ id: 'n2', position: { x: 100, y: 50 }, data: { node: { name: 'Muffe Süd' } } },
			{ id: 'n3', position: { x: 10, y: 10 }, data: {} }
		],
		edges: [
			{ id: 'e1', source: 'n1', target: 'n2', data: { label: 'Kabel Nord' } },
			{ id: 'e2', source: 'n1', target: 'missing', data: { cable: { name: 'Hauptkabel' } } }
		]
	} as unknown as NetworkSchemaState;
}

describe('searchResults', () => {
	test('should return no results for an empty search term', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());

		manager.searchTerm = '   ';

		expect(manager.searchResults).toEqual([]);
	});

	test('should match nodes by label and by node name, case-insensitively', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());

		manager.searchTerm = 'PO';
		expect(manager.searchResults).toEqual([
			{
				type: 'node',
				id: 'n1',
				name: 'PoP Nord',
				position: { x: 0, y: 0 },
				data: { label: 'PoP Nord' }
			}
		]);

		manager.searchTerm = 'muffe';
		expect(manager.searchResults[0].name).toBe('Muffe Süd');
	});

	test('should match cables by label and by cable name', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());

		manager.searchTerm = 'kabel';

		const results = manager.searchResults;
		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({
			type: 'cable',
			id: 'e1',
			name: 'Kabel Nord',
			source: 'n1',
			target: 'n2',
			data: { label: 'Kabel Nord' }
		});
		expect(results[1].name).toBe('Hauptkabel');
	});

	test('should combine node and cable matches', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());

		manager.searchTerm = 'nord';

		expect(manager.searchResults.map((r) => r.id)).toEqual(['n1', 'e1']);
	});
});

describe('getResultPosition', () => {
	test('should return the node position for node results', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());
		manager.searchTerm = 'pop';

		expect(manager.getResultPosition(manager.searchResults[0])).toEqual({ x: 0, y: 0 });
	});

	test('should return the midpoint between source and target for cables', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());
		manager.searchTerm = 'kabel nord';

		expect(manager.getResultPosition(manager.searchResults[0])).toEqual({ x: 50, y: 25 });
	});

	test('should return null when a cable endpoint is missing', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());
		manager.searchTerm = 'hauptkabel';

		expect(manager.getResultPosition(manager.searchResults[0])).toBeNull();
	});
});

describe('highlighting', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('should set and clear the highlighted item', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());

		manager.setHighlight('n1');
		expect(manager.highlightedItemId).toBe('n1');

		manager.setHighlight(null);
		expect(manager.highlightedItemId).toBeNull();
	});

	test('should clear the highlight after the delay', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());
		manager.setHighlight('n1');

		manager.clearHighlightAfterDelay(1000);
		expect(manager.highlightedItemId).toBe('n1');

		vi.advanceTimersByTime(1000);
		expect(manager.highlightedItemId).toBeNull();
	});
});

describe('clearSearch', () => {
	test('should reset the term and highlight', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());
		manager.searchTerm = 'pop';
		manager.setHighlight('n1');

		manager.clearSearch();

		expect(manager.searchTerm).toBe('');
		expect(manager.highlightedItemId).toBeNull();
		expect(manager.searchResults).toEqual([]);
	});
});

describe('lookups', () => {
	test('should find nodes and edges by id', () => {
		const manager = new NetworkSchemaSearchManager(makeSchemaState());

		expect(manager.getNodeById('n2')?.id).toBe('n2');
		expect(manager.getNodeById('missing')).toBeUndefined();
		expect(manager.getEdgeById('e1')?.id).toBe('e1');
		expect(manager.getEdgeById('missing')).toBeUndefined();
	});
});
