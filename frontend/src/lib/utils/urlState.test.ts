import { goto } from '$app/navigation';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	closeFeature,
	DEFAULT_PAGE_SIZE,
	featureParam,
	openFeature,
	queryEnum,
	queryFeature,
	queryInt,
	queryList,
	queryString,
	setQuery,
	withParams
} from './urlState';

const appState = vi.hoisted(() => ({
	page: { url: new URL('http://localhost/conduit/5?search=DN50&page=2#map=17/1/2') }
}));

vi.mock('$app/state', () => ({
	page: appState.page
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

function url(search = '', hash = ''): URL {
	return new URL(`http://localhost/conduit/5${search}${hash}`);
}

describe('withParams', () => {
	test('should preserve unrelated params and the hash', () => {
		expect(withParams(url('?search=DN50&page=2', '#map=17/1/2'), { tab: 'cables' })).toBe(
			'/conduit/5?search=DN50&page=2&tab=cables#map=17/1/2'
		);
	});

	test('should delete a key on null, undefined and empty string', () => {
		const start = url('?search=DN50&page=2&tab=cables');

		expect(withParams(start, { search: null })).toBe('/conduit/5?page=2&tab=cables');
		expect(withParams(start, { search: undefined })).toBe('/conduit/5?page=2&tab=cables');
		expect(withParams(start, { search: '' })).toBe('/conduit/5?page=2&tab=cables');
	});

	test('should delete a reserved param set to its default', () => {
		expect(withParams(url('?search=DN50&page=2'), { page: 1 })).toBe('/conduit/5?search=DN50');
		expect(withParams(url('?page_size=25'), { page_size: DEFAULT_PAGE_SIZE })).toBe('/conduit/5');
	});

	test('should keep the position of an existing key and append new ones', () => {
		expect(withParams(url('?a=1&b=2&c=3'), { b: 'x', d: 4 })).toBe('/conduit/5?a=1&b=x&c=3&d=4');
	});

	test('should return the bare path when no params remain', () => {
		expect(withParams(url('?page=2'), { page: null })).toBe('/conduit/5');
	});
});

describe('setQuery', () => {
	beforeEach(() => {
		vi.mocked(goto).mockClear();
	});

	test('should replace the current entry and keep focus and scroll by default', () => {
		setQuery({ page: 3 });

		expect(goto).toHaveBeenCalledWith('/conduit/5?search=DN50&page=3#map=17/1/2', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});

	test('should push a history entry for a place', () => {
		setQuery({ feature: 'trench:abc', page: null }, { push: true });

		expect(goto).toHaveBeenCalledWith('/conduit/5?search=DN50&feature=trench%3Aabc#map=17/1/2', {
			keepFocus: true,
			noScroll: true,
			replaceState: false
		});
	});
});

describe('queryString', () => {
	test('should read the value and fall back when missing or empty', () => {
		expect(queryString(url('?search=DN50'), 'search')).toBe('DN50');
		expect(queryString(url(), 'search')).toBe('');
		expect(queryString(url('?search='), 'search', 'x')).toBe('x');
	});
});

describe('queryInt', () => {
	test('should parse a whole number', () => {
		expect(queryInt(url('?page=7'), 'page', 1)).toBe(7);
	});

	test('should fall back when missing, empty or malformed', () => {
		expect(queryInt(url(), 'page', 1)).toBe(1);
		expect(queryInt(url('?page='), 'page', 1)).toBe(1);
		expect(queryInt(url('?page=abc'), 'page', 1)).toBe(1);
		expect(queryInt(url('?page=1.5'), 'page', 1)).toBe(1);
		expect(queryInt(url('?page=Infinity'), 'page', 1)).toBe(1);
	});

	test('should clamp to the range', () => {
		expect(queryInt(url('?page=0'), 'page', 1, { min: 1 })).toBe(1);
		expect(queryInt(url('?page=-4'), 'page', 1, { min: 1 })).toBe(1);
		expect(queryInt(url('?page_size=9000'), 'page_size', 50, { max: 500 })).toBe(500);
	});
});

describe('queryEnum', () => {
	const TABS = ['stats', 'trench', 'cables'] as const;

	test('should return an allowed value', () => {
		expect(queryEnum(url('?tab=trench'), 'tab', TABS, 'stats')).toBe('trench');
	});

	test('should fall back when missing or not allowed', () => {
		expect(queryEnum(url(), 'tab', TABS, 'stats')).toBe('stats');
		expect(queryEnum(url('?tab=Trench'), 'tab', TABS, 'stats')).toBe('stats');
		expect(queryEnum(url('?tab=nope'), 'tab', TABS, 'stats')).toBe('stats');
	});
});

describe('queryList', () => {
	test('should split on commas and drop blanks', () => {
		expect(queryList(url('?areas=a,b,%20c,,'), 'areas')).toEqual(['a', 'b', 'c']);
	});

	test('should return an empty list when missing or empty', () => {
		expect(queryList(url(), 'areas')).toEqual([]);
		expect(queryList(url('?areas='), 'areas')).toEqual([]);
	});
});

describe('queryFeature', () => {
	const kinds = ['conduit', 'trench'] as const;

	test('should read the kind and id of the drawer feature', () => {
		expect(queryFeature(url('?feature=conduit:9b1c-2'), kinds)).toEqual({
			kind: 'conduit',
			id: '9b1c-2'
		});
	});

	test('should treat a missing parameter as a closed drawer', () => {
		expect(queryFeature(url(), kinds)).toBeNull();
		expect(queryFeature(url('?feature='), kinds)).toBeNull();
	});

	test('should ignore a kind the page cannot show', () => {
		expect(queryFeature(url('?feature=cable:abc'), kinds)).toBeNull();
	});

	test('should ignore a malformed value', () => {
		expect(queryFeature(url('?feature=bogus'), kinds)).toBeNull();
		expect(queryFeature(url('?feature=conduit:'), kinds)).toBeNull();
		expect(queryFeature(url('?feature=conduit:a%20b'), kinds)).toBeNull();
	});
});

describe('featureParam', () => {
	test('should join kind and id', () => {
		expect(featureParam('trench', '3f2a')).toBe('trench:3f2a');
	});
});

describe('openFeature', () => {
	beforeEach(() => {
		vi.mocked(goto).mockClear();
	});

	test('should push a history entry when the drawer was closed', () => {
		appState.page.url = url('?search=DN50');

		openFeature('conduit', 'abc');

		expect(goto).toHaveBeenCalledWith('/conduit/5?search=DN50&feature=conduit%3Aabc', {
			keepFocus: true,
			noScroll: true,
			replaceState: false
		});
	});

	test('should replace the entry and keep the tab when switching the open feature', () => {
		appState.page.url = url('?feature=conduit%3Aabc&tab=files');

		openFeature('conduit', 'def');

		expect(goto).toHaveBeenCalledWith('/conduit/5?feature=conduit%3Adef&tab=files', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});
});

describe('closeFeature', () => {
	test('should do nothing while no drawer is open', () => {
		vi.mocked(goto).mockClear();
		appState.page.url = url('?search=DN50');

		closeFeature();

		expect(goto).not.toHaveBeenCalled();
	});

	test('should replace the entry with the URL without feature and tab', () => {
		vi.mocked(goto).mockClear();
		appState.page.url = url('?search=DN50&feature=conduit%3Aabc&tab=files', '#map=1/2/3');

		closeFeature();

		expect(goto).toHaveBeenCalledWith('/conduit/5?search=DN50#map=1/2/3', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});
});
