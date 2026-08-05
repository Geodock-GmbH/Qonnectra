// @vitest-environment jsdom
import { get } from 'svelte/store';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { session } from './session';

vi.mock('$app/environment', () => ({
	browser: true
}));

afterEach(() => {
	sessionStorage.clear();
});

describe('session', () => {
	test('should start with the initial value when nothing is stored', () => {
		const store = session('test-key', 'fallback');
		expect(get(store)).toBe('fallback');
	});

	test('should load an existing value from sessionStorage', () => {
		sessionStorage.setItem('test-key', JSON.stringify(['a', 'b']));

		const store = session('test-key', [] as string[]);
		expect(get(store)).toEqual(['a', 'b']);
	});

	test('should write updates back to sessionStorage', () => {
		const store = session('test-key', 'initial');
		const unsubscribe = store.subscribe(() => {});

		store.set('updated');

		expect(sessionStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
		unsubscribe();
	});

	test('should keep the initial value for malformed stored JSON', () => {
		sessionStorage.setItem('test-key', '{not valid json');

		const store = session('test-key', 'fallback');
		expect(get(store)).toBe('fallback');
	});
});
