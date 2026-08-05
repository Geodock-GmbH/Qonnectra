// @vitest-environment jsdom
import { get } from 'svelte/store';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { persisted } from './persisted';

vi.mock('$app/environment', () => ({
	browser: true
}));

afterEach(() => {
	localStorage.clear();
});

describe('persisted', () => {
	test('should start with the initial value when nothing is stored', () => {
		const store = persisted('test-key', 'fallback');
		expect(get(store)).toBe('fallback');
	});

	test('should load an existing value from localStorage', () => {
		localStorage.setItem('test-key', JSON.stringify({ zoom: 12 }));

		const store = persisted('test-key', { zoom: 2 });
		expect(get(store)).toEqual({ zoom: 12 });
	});

	test('should write updates back to localStorage', () => {
		const store = persisted('test-key', 'initial');
		const unsubscribe = store.subscribe(() => {});

		store.set('updated');

		expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
		unsubscribe();
	});

	test('should keep the initial value for malformed stored JSON', () => {
		localStorage.setItem('test-key', '{not valid json');

		const store = persisted('test-key', 'fallback');
		expect(get(store)).toBe('fallback');
	});
});
