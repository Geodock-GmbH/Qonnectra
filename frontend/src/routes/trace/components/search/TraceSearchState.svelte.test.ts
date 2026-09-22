import { beforeEach, describe, expect, test, vi } from 'vitest';

import { TraceSearchState } from './TraceSearchState.svelte';

const { pageState, gotoMock } = vi.hoisted(() => ({
	pageState: { url: new URL('http://localhost/trace'), params: {} },
	gotoMock: vi.fn()
}));

vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

const REPLACE = { keepFocus: true, noScroll: true, replaceState: true };
const PUSH = { keepFocus: true, noScroll: true, replaceState: false };

/**
 * @param search - The landing's query string, without the `?`.
 */
function atUrl(search: string) {
	pageState.url = new URL(`http://localhost/trace${search ? `?${search}` : ''}`);
}

describe('TraceSearchState', () => {
	let search: TraceSearchState;

	beforeEach(() => {
		atUrl('');
		gotoMock.mockReset();
		search = new TraceSearchState();
	});

	test('should offer addresses with no options when the URL names nothing', () => {
		expect(search.activeType).toBe('address');
		expect(search.searchType).toBe('address');
		expect(search.globalSearch).toBe(false);
		expect(search.includeGeometry).toBe(false);
		expect(search.geometryMode).toBe('segments');
		expect(search.orientGeometry).toBe(false);
		expect(search.selectedCableUuid).toBeNull();
	});

	test('should read the entry type from its URL slug', () => {
		atUrl('type=residential-unit');

		expect(search.activeType).toBe('residential_unit');
		expect(search.searchType).toBe('residential_unit');
	});

	test('should fall back to addresses for an unknown type', () => {
		atUrl('type=router');

		expect(search.activeType).toBe('address');
	});

	test('should search cables while a fiber is being picked', () => {
		atUrl('type=fiber');

		expect(search.searchType).toBe('cable');
	});

	test('should read the options as the result page spells them', () => {
		atUrl('global=true&include_geometry=true&geometry_mode=merged&orient_geometry=true');

		expect(search.globalSearch).toBe(true);
		expect(search.includeGeometry).toBe(true);
		expect(search.geometryMode).toBe('merged');
		expect(search.orientGeometry).toBe(true);
	});

	test('should ignore an unknown geometry mode', () => {
		atUrl('geometry_mode=curvy');

		expect(search.geometryMode).toBe('segments');
	});

	test('should name the picked cable only on the fiber tab', () => {
		atUrl('type=fiber&cable=c-1');
		expect(search.selectedCableUuid).toBe('c-1');

		atUrl('type=cable&cable=c-1');
		expect(search.selectedCableUuid).toBeNull();
	});

	test('should treat a malformed cable id as none', () => {
		atUrl('type=fiber&cable=c%201');

		expect(search.selectedCableUuid).toBeNull();
	});

	test('should switch the type by rewriting the entry and drop the picked cable', () => {
		atUrl('type=fiber&cable=c-1&global=true');

		search.setActiveType('node');

		expect(gotoMock).toHaveBeenCalledWith('/trace?type=node&global=true', REPLACE);
	});

	test('should leave the default type out of the URL', () => {
		atUrl('type=node');

		search.setActiveType('address');

		expect(gotoMock).toHaveBeenCalledWith('/trace', REPLACE);
	});

	test('should spell the residential unit type with a hyphen', () => {
		search.setActiveType('residential_unit');

		expect(gotoMock).toHaveBeenCalledWith('/trace?type=residential-unit', REPLACE);
	});

	test('should pick a cable as a place and clear it in place', () => {
		atUrl('type=fiber');

		search.pickCable('c-1');
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?type=fiber&cable=c-1', PUSH);

		atUrl('type=fiber&cable=c-1');
		search.clearCable();
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?type=fiber', REPLACE);
	});

	test('should write the options in place and drop their defaults', () => {
		search.setGlobalSearch(true);
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?global=true', REPLACE);

		search.setIncludeGeometry(true);
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?include_geometry=true', REPLACE);

		search.setGeometryMode('routed');
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?geometry_mode=routed', REPLACE);

		search.setOrientGeometry(true);
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?orient_geometry=true', REPLACE);

		atUrl('global=true&include_geometry=true&geometry_mode=routed&orient_geometry=true');
		search.setGlobalSearch(false);
		search.setIncludeGeometry(false);
		search.setGeometryMode('segments');
		search.setOrientGeometry(false);
		expect(gotoMock.mock.calls.slice(-4).map(([href]) => href)).toEqual([
			'/trace?include_geometry=true&geometry_mode=routed&orient_geometry=true',
			'/trace?global=true&geometry_mode=routed&orient_geometry=true',
			'/trace?global=true&include_geometry=true&orient_geometry=true',
			'/trace?global=true&include_geometry=true&geometry_mode=routed'
		]);
	});

	test('should address a trace without geometry by its plain path', () => {
		expect(search.tracePath('residential_unit', 'ru-1')).toBe('/trace/residential-unit/ru-1');
	});

	test('should carry the geometry options into the result URL unchanged', () => {
		atUrl('include_geometry=true&geometry_mode=merged');

		expect(search.tracePath('fiber', 'f-1')).toBe(
			'/trace/fiber/f-1?include_geometry=true&geometry_mode=merged'
		);

		atUrl('include_geometry=true&geometry_mode=merged&orient_geometry=true');

		expect(search.tracePath('fiber', 'f-1')).toBe(
			'/trace/fiber/f-1?include_geometry=true&geometry_mode=merged&orient_geometry=true'
		);
	});

	test('should ignore the geometry mode and orientation while geometry is off', () => {
		atUrl('geometry_mode=routed&orient_geometry=true');

		expect(search.tracePath('cable', 'c-1')).toBe('/trace/cable/c-1');
	});
});
