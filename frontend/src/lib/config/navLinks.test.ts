import { describe, expect, test, vi } from 'vitest';

import { selectedFlag } from '$lib/stores/store';

import { allNavLinks, findProjectLink, isActive, navHref } from './navLinks';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

function link(id: string) {
	const found = allNavLinks.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`no nav link ${id}`);
	return found;
}

describe('navHref', () => {
	test('should build project links for the given project', () => {
		expect(navHref(link('map'), '7')).toBe('/project/7/map');
		expect(navHref(link('address'), '7')).toBe('/project/7/address');
	});

	test('should keep a flag on the dashboard and trench links', () => {
		expect(navHref(link('dashboard'), '7', { flagId: '3' })).toBe('/project/7/dashboard/3');
		expect(navHref(link('trench'), '7', { flagId: '3' })).toBe('/project/7/trench/3');
		expect(navHref(link('dashboard'), '7')).toBe('/project/7/dashboard');
	});

	test('should open the trench link on the preferred flag when no flag is kept', () => {
		selectedFlag.set(['5']);
		expect(navHref(link('trench'), '7')).toBe('/project/7/trench/5');

		selectedFlag.set(['6']);
		expect(navHref(link('trench'), '7')).toBe('/project/7/trench/6');
		expect(navHref(link('trench'), '7', { flagId: '3' })).toBe('/project/7/trench/3');
	});

	test('should ignore the project for global links', () => {
		expect(navHref(link('trace'), '7')).toBe('/trace');
		expect(navHref(link('settings'), null)).toBe('/settings');
	});

	test('should send a project link to the landing redirect without a project', () => {
		expect(navHref(link('map'), null)).toBe('/');
	});
});

describe('isActive', () => {
	test('should activate a link on its own route and on nested routes', () => {
		expect(isActive(link('address'), '/project/[projectId=integer]/address')).toBe(true);
		expect(isActive(link('address'), '/project/[projectId=integer]/address/[uuid]')).toBe(true);
		expect(
			isActive(link('network-schema'), '/project/[projectId=integer]/network-schema/node/[nodeId]')
		).toBe(true);
	});

	test('should not activate a link on a sibling or a global route', () => {
		expect(isActive(link('map'), '/project/[projectId=integer]/address')).toBe(false);
		expect(isActive(link('trace'), '/trace')).toBe(true);
		expect(isActive(link('trace'), '/settings')).toBe(false);
		expect(isActive(link('map'), null)).toBe(false);
	});
});

describe('findProjectLink', () => {
	test('should find the project link above a nested route', () => {
		expect(findProjectLink('/project/[projectId=integer]/address/[uuid]')?.id).toBe('address');
		expect(findProjectLink('/project/[projectId=integer]/dashboard/[[flagId]]')?.id).toBe(
			'dashboard'
		);
	});

	test('should find nothing on a global page', () => {
		expect(findProjectLink('/trace/[entryType=traceEntryType]/[uuid]')).toBeUndefined();
		expect(findProjectLink(null)).toBeUndefined();
	});
});
