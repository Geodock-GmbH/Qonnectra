import Fuse from 'fuse.js';
import { describe, expect, test } from 'vitest';

interface ComboboxItem {
	label: string;
	value: string;
}

/**
 * Calculates the visible item range for virtual scrolling.
 * Extracted here so we can test it without rendering the Svelte component.
 */
function getVisibleRange(
	scrollTop: number,
	itemHeight: number,
	maxVisible: number,
	totalItems: number,
	overscan: number = 3
): { start: number; end: number } {
	const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
	const end = Math.min(totalItems, Math.floor(scrollTop / itemHeight) + maxVisible + overscan);
	return { start, end };
}

describe('VirtualCombobox virtual scroll', () => {
	const ITEM_HEIGHT = 40;
	const MAX_VISIBLE = 8;
	const TOTAL = 2000;

	test('initial scroll position shows first items with overscan', () => {
		const { start, end } = getVisibleRange(0, ITEM_HEIGHT, MAX_VISIBLE, TOTAL);
		expect(start).toBe(0);
		expect(end).toBe(11); // 0 + 8 + 3 overscan
	});

	test('scrolled midway calculates correct range', () => {
		const scrollTop = 400; // 10 items down
		const { start, end } = getVisibleRange(scrollTop, ITEM_HEIGHT, MAX_VISIBLE, TOTAL);
		expect(start).toBe(7); // 10 - 3 overscan
		expect(end).toBe(21); // 10 + 8 + 3 overscan
	});

	test('scrolled to bottom clamps end to total', () => {
		const scrollTop = (TOTAL - 1) * ITEM_HEIGHT;
		const { start, end } = getVisibleRange(scrollTop, ITEM_HEIGHT, MAX_VISIBLE, TOTAL);
		expect(end).toBe(TOTAL);
		expect(start).toBeLessThan(TOTAL);
	});

	test('small list where total < maxVisible', () => {
		const { start, end } = getVisibleRange(0, ITEM_HEIGHT, MAX_VISIBLE, 3);
		expect(start).toBe(0);
		expect(end).toBe(3);
	});

	test('empty list returns zero range', () => {
		const { start, end } = getVisibleRange(0, ITEM_HEIGHT, MAX_VISIBLE, 0);
		expect(start).toBe(0);
		expect(end).toBe(0);
	});
});

describe('VirtualCombobox fuzzy search', () => {
	const data: ComboboxItem[] = Array.from({ length: 100 }, (_, i) => ({
		label: `Node ${i}`,
		value: `node-${i}`
	}));

	let fuse: Fuse<ComboboxItem>;

	/**
	 * Filters items using Fuse.js fuzzy search, returning all items when query is empty.
	 */
	function filterItems(query: string): ComboboxItem[] {
		if (!query) return data;
		const results = fuse.search(query);
		return results.length > 0 ? results.map((r) => r.item) : [];
	}

	test('empty query returns all items', () => {
		fuse = new Fuse(data, { keys: ['label', 'value'], threshold: 0.3 });
		expect(filterItems('')).toHaveLength(100);
	});

	test('filters by label', () => {
		fuse = new Fuse(data, { keys: ['label', 'value'], threshold: 0.3 });
		const results = filterItems('Node 5');
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].label).toContain('5');
	});

	test('returns empty array for no matches', () => {
		fuse = new Fuse(data, { keys: ['label', 'value'], threshold: 0.3 });
		expect(filterItems('zzzzzzzzz')).toHaveLength(0);
	});

	test('fuzzy matches with typos', () => {
		const named: ComboboxItem[] = [
			{ label: 'Hauptverteiler', value: 'hv' },
			{ label: 'Kabelverzweiger', value: 'kvz' }
		];
		fuse = new Fuse(named, { keys: ['label', 'value'], threshold: 0.3 });
		const results = filterItems('Hauptvertiler'); // typo
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].value).toBe('hv');
	});
});
