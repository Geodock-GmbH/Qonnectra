import Fuse from 'fuse.js';
import { describe, expect, test } from 'vitest';

/**
 * Calculates the visible item range for virtual scrolling.
 * Extracted here so we can test it without rendering the Svelte component.
 * @param {number} scrollTop - Current scroll offset in pixels.
 * @param {number} itemHeight - Height of each item in pixels.
 * @param {number} maxVisible - Maximum number of items visible in the viewport.
 * @param {number} totalItems - Total number of items in the list.
 * @param {number} [overscan=3] - Extra items to render above/below the viewport.
 * @returns {{ start: number, end: number }} Start and end indices of the visible range.
 */
function getVisibleRange(scrollTop, itemHeight, maxVisible, totalItems, overscan = 3) {
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
	const data = Array.from({ length: 100 }, (_, i) => ({
		label: `Node ${i}`,
		value: `node-${i}`
	}));

	/** @type {Fuse<{label: string, value: string}>} */
	let fuse;

	/**
	 * Filters items using Fuse.js fuzzy search, returning all items when query is empty.
	 * @param {string} query - Search string to match against item labels and values.
	 * @returns {{ label: string, value: string }[]} Matching items, or all items if query is empty.
	 */
	function filterItems(query) {
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
		const named = [
			{ label: 'Hauptverteiler', value: 'hv' },
			{ label: 'Kabelverzweiger', value: 'kvz' }
		];
		fuse = new Fuse(named, { keys: ['label', 'value'], threshold: 0.3 });
		const results = filterItems('Hauptvertiler'); // typo
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].value).toBe('hv');
	});
});
