// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { readStoredView, resolveInitialView, writeStoredView } from './storedView';

vi.mock('$app/environment', () => ({ browser: true }));

beforeEach(() => {
	localStorage.clear();
});

describe('storedView', () => {
	test('should round trip a view per project', () => {
		writeStoredView('5', { zoom: 14.5, center: [1, 2] });

		expect(readStoredView('5')).toEqual({ zoom: 14.5, center: [1, 2] });
		expect(readStoredView('6')).toBeNull();
	});

	test('should ignore an empty project and unreadable entries', () => {
		writeStoredView('', { zoom: 1, center: [0, 0] });
		localStorage.setItem('mapView:7', '{not json');
		localStorage.setItem('mapView:8', JSON.stringify({ zoom: 'x', center: [1] }));

		expect(readStoredView('')).toBeNull();
		expect(readStoredView('7')).toBeNull();
		expect(readStoredView('8')).toBeNull();
	});
});

describe('resolveInitialView', () => {
	test('should prefer the hash over the remembered view', () => {
		writeStoredView('5', { zoom: 10, center: [0, 0] });

		expect(resolveInitialView({ hashView: { zoom: 17, center: [3, 4] }, projectId: '5' })).toEqual({
			zoom: 17,
			center: [3, 4]
		});
	});

	test('should fall back to the remembered view, then to nothing', () => {
		writeStoredView('5', { zoom: 10, center: [0, 0] });

		expect(resolveInitialView({ hashView: null, projectId: '5' })).toEqual({
			zoom: 10,
			center: [0, 0]
		});
		expect(resolveInitialView({ hashView: null, projectId: '9' })).toBeNull();
	});
});
