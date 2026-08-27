// @vitest-environment jsdom
import { get } from 'svelte/store';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
	isGroupCollapsed,
	isRouteHidden,
	sidebarPreferences,
	toggleGroupCollapsed,
	toggleRouteHidden
} from './sidebarPreferences';

vi.mock('$app/environment', () => ({
	browser: true
}));

afterEach(() => {
	localStorage.clear();
	sidebarPreferences.set({ hiddenRoutes: [], collapsedGroups: [] });
});

describe('sidebarPreferences store', () => {
	test('defaults to nothing hidden and nothing collapsed', () => {
		expect(get(sidebarPreferences)).toEqual({ hiddenRoutes: [], collapsedGroups: [] });
	});
});

describe('isRouteHidden', () => {
	test('returns true only for ids in hiddenRoutes', () => {
		const prefs = { hiddenRoutes: ['map'], collapsedGroups: [] };
		expect(isRouteHidden(prefs, 'map')).toBe(true);
		expect(isRouteHidden(prefs, 'dashboard')).toBe(false);
	});
});

describe('toggleRouteHidden', () => {
	test('adds a route id when not present', () => {
		const next = toggleRouteHidden({ hiddenRoutes: [], collapsedGroups: [] }, 'map');
		expect(next.hiddenRoutes).toEqual(['map']);
	});

	test('removes a route id when already present', () => {
		const next = toggleRouteHidden({ hiddenRoutes: ['map'], collapsedGroups: [] }, 'map');
		expect(next.hiddenRoutes).toEqual([]);
	});

	test('does not mutate the input', () => {
		const prefs = { hiddenRoutes: ['map'], collapsedGroups: [] };
		toggleRouteHidden(prefs, 'dashboard');
		expect(prefs.hiddenRoutes).toEqual(['map']);
	});

	test('leaves collapsedGroups untouched', () => {
		const next = toggleRouteHidden({ hiddenRoutes: [], collapsedGroups: ['cable'] }, 'map');
		expect(next.collapsedGroups).toEqual(['cable']);
	});
});

describe('isGroupCollapsed', () => {
	test('returns true only for ids in collapsedGroups', () => {
		const prefs = { hiddenRoutes: [], collapsedGroups: ['cable'] };
		expect(isGroupCollapsed(prefs, 'cable')).toBe(true);
		expect(isGroupCollapsed(prefs, 'main')).toBe(false);
	});
});

describe('toggleGroupCollapsed', () => {
	test('adds a group id when not present', () => {
		const next = toggleGroupCollapsed({ hiddenRoutes: [], collapsedGroups: [] }, 'cable');
		expect(next.collapsedGroups).toEqual(['cable']);
	});

	test('removes a group id when already present', () => {
		const next = toggleGroupCollapsed({ hiddenRoutes: [], collapsedGroups: ['cable'] }, 'cable');
		expect(next.collapsedGroups).toEqual([]);
	});

	test('does not mutate the input', () => {
		const prefs = { hiddenRoutes: [], collapsedGroups: ['cable'] };
		toggleGroupCollapsed(prefs, 'main');
		expect(prefs.collapsedGroups).toEqual(['cable']);
	});
});

describe('persistence', () => {
	test('writes preferences to localStorage as JSON', () => {
		const unsubscribe = sidebarPreferences.subscribe(() => {});
		sidebarPreferences.set({ hiddenRoutes: ['map'], collapsedGroups: ['cable'] });

		expect(JSON.parse(localStorage.getItem('sidebarPreferences') ?? '{}')).toEqual({
			hiddenRoutes: ['map'],
			collapsedGroups: ['cable']
		});
		unsubscribe();
	});
});
