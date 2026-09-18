// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';

import {
	emptyConduitFormDefaults,
	loadConduitFormDefaults,
	saveConduitFormDefaults
} from './conduitFormDefaults';

const STORAGE_KEY = 'conduit-form-defaults';

beforeEach(() => {
	localStorage.clear();
});

describe('conduitFormDefaults', () => {
	test('should return empty values when nothing is stored', () => {
		expect(loadConduitFormDefaults()).toEqual(emptyConduitFormDefaults());
	});

	test('should round-trip saved values through localStorage', () => {
		const values = {
			...emptyConduitFormDefaults(),
			conduitName: 'DA 50',
			conduitType: ['3'],
			constructor: ['7'],
			date: '2026-01-01'
		};

		saveConduitFormDefaults(values);

		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(values);
		expect(loadConduitFormDefaults()).toEqual(values);
	});

	test('should fill missing keys of a partial stored entry', () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ conduitName: 'Rohr' }));

		expect(loadConduitFormDefaults()).toEqual({
			...emptyConduitFormDefaults(),
			conduitName: 'Rohr'
		});
	});

	test('should fall back to empty values for malformed stored JSON', () => {
		localStorage.setItem(STORAGE_KEY, '{not json');

		expect(loadConduitFormDefaults()).toEqual(emptyConduitFormDefaults());
	});
});
