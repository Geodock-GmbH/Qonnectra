import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Fuse from 'fuse.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Test Fuse.js fuzzy search behavior directly
describe('GenericCombobox Fuzzy Search', () => {
	const testData = [
		{ label: 'Apple', value: 'apple' },
		{ label: 'Application', value: 'application' },
		{ label: 'Banana', value: 'banana' },
		{ label: 'Cherry', value: 'cherry' },
		{ label: 'Date', value: 'date' },
		{ label: 'Elderberry', value: 'elderberry' }
	];

	/** @type {Fuse<{label: string, value: string}>} */
	let fuse;

	beforeEach(() => {
		fuse = new Fuse(testData, {
			keys: ['label', 'value'],
			threshold: 0.3
		});
	});

	test('should find exact matches', () => {
		const results = fuse.search('Apple');
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].item.label).toBe('Apple');
	});

	test('should find partial matches', () => {
		const results = fuse.search('App');
		expect(results.length).toBe(2);
		const labels = results.map(
			(/** @type {{ item: {label: string, value: string} }} */ r) => r.item.label
		);
		expect(labels).toContain('Apple');
		expect(labels).toContain('Application');
	});

	test('should find fuzzy matches with typos', () => {
		const results = fuse.search('Appel'); // typo for Apple
		expect(results.length).toBeGreaterThan(0);
		const labels = results.map(
			(/** @type {{ item: {label: string, value: string} }} */ r) => r.item.label
		);
		expect(labels).toContain('Apple');
	});

	test('should match on value field', () => {
		const results = fuse.search('banana');
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].item.value).toBe('banana');
	});

	test('should return empty array for no matches with threshold', () => {
		const results = fuse.search('xyz123');
		expect(results.length).toBe(0);
	});

	test('should be case insensitive', () => {
		const results = fuse.search('apple');
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].item.label).toBe('Apple');
	});

	test('should rank better matches higher', () => {
		const results = fuse.search('App');
		// Apple should rank higher than Application for shorter match
		expect(results[0].item.label).toBe('Apple');
	});

	test('should handle empty search string', () => {
		const results = fuse.search('');
		expect(results.length).toBe(0);
	});

	test('should handle special characters', () => {
		const specialData = [
			{ label: 'Test (parentheses)', value: 'test-paren' },
			{ label: 'Test [brackets]', value: 'test-bracket' }
		];
		const specialFuse = new Fuse(specialData, {
			keys: ['label', 'value'],
			threshold: 0.3
		});

		const results = specialFuse.search('parentheses');
		expect(results.length).toBeGreaterThan(0);
	});

	test('should handle unicode characters', () => {
		const unicodeData = [
			{ label: 'Größe', value: 'groesse' },
			{ label: 'Müller', value: 'mueller' }
		];
		const unicodeFuse = new Fuse(unicodeData, {
			keys: ['label', 'value'],
			threshold: 0.3
		});

		const results = unicodeFuse.search('Größe');
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].item.label).toBe('Größe');
	});
});

describe('GenericCombobox Fuzzy Search Integration', () => {
	test('should filter items based on fuzzy search input simulation', () => {
		const data = [
			{ label: 'Node Type A', value: 'type-a' },
			{ label: 'Node Type B', value: 'type-b' },
			{ label: 'Cable Type', value: 'cable' }
		];

		const fuse = new Fuse(data, {
			keys: ['label', 'value'],
			threshold: 0.3
		});

		// Simulate the onInputValueChange behavior
		const onInputValueChange = (/** @type {string} */ inputValue) => {
			if (!inputValue) {
				return data;
			}
			const results = fuse.search(inputValue);
			if (results.length > 0) {
				return results.map((result) => result.item);
			}
			return data;
		};

		// Test filtering
		const filteredA = onInputValueChange('Node');
		expect(filteredA.length).toBe(2);
		expect(filteredA.every((item) => item.label.includes('Node'))).toBe(true);

		const filteredCable = onInputValueChange('Cable');
		expect(filteredCable.length).toBe(1);
		expect(filteredCable[0].value).toBe('cable');

		// Test empty returns all
		const all = onInputValueChange('');
		expect(all.length).toBe(3);

		// Test no match returns all (fallback behavior)
		const noMatch = onInputValueChange('xyz999');
		expect(noMatch.length).toBe(3);
	});
});
