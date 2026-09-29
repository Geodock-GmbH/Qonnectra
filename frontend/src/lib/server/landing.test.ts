import { describe, expect, test } from 'vitest';

import { NO_ACCESS_PATH, resolveLandingPath } from './landing';

const projects = [
	{ value: '7', label: 'Nord' },
	{ value: '9', label: 'Süd' }
];

describe('resolveLandingPath', () => {
	test('should land on the preferred project when it is one of the user projects', () => {
		expect(resolveLandingPath(projects, '9')).toBe('/project/9/map');
	});

	test('should fall back to the first project for an unknown or missing preference', () => {
		expect(resolveLandingPath(projects, '42')).toBe('/project/7/map');
		expect(resolveLandingPath(projects, null)).toBe('/project/7/map');
		expect(resolveLandingPath(projects, undefined)).toBe('/project/7/map');
	});

	test('should send a user without projects to the settings page', () => {
		expect(resolveLandingPath([], '7')).toBe('/settings');
	});
});

describe('resolveLandingPath with route permissions', () => {
	/**
	 * Builds a non-superuser permission set with only route rows.
	 */
	const withRoutes = (routes: Record<string, boolean>) => ({
		models: {},
		routes,
		is_superuser: false
	});

	test('should keep the map when the permissions allow it', () => {
		expect(resolveLandingPath(projects, '9', withRoutes({ '/valuation': false }))).toBe(
			'/project/9/map'
		);
	});

	test('should land on the first allowed page in sidebar order when the map is denied', () => {
		expect(resolveLandingPath(projects, '9', withRoutes({ '/map': false }))).toBe(
			'/project/9/dashboard'
		);
	});

	test('should land on the only whitelisted page', () => {
		const permissions = withRoutes({ '/*': false, '/address': true });
		expect(resolveLandingPath(projects, '9', permissions)).toBe('/project/9/address');
	});

	test('should fall back to a global page without projects when settings is denied', () => {
		expect(resolveLandingPath([], null, withRoutes({ '/settings': false }))).toBe(
			'/pipeline-records'
		);
	});

	test('should never land on the admin logs, which bounce non-admins back', () => {
		const permissions = withRoutes({ '/*': false, '/admin/logs': true });
		expect(resolveLandingPath(projects, '9', permissions)).toBe(NO_ACCESS_PATH);
	});

	test('should land on the no-access notice when every page is denied', () => {
		expect(resolveLandingPath(projects, '9', withRoutes({ '/*': false }))).toBe(NO_ACCESS_PATH);
	});

	test('should ignore route rows for a superuser', () => {
		const permissions = { models: {}, routes: { '/map': false }, is_superuser: true };
		expect(resolveLandingPath(projects, '9', permissions)).toBe('/project/9/map');
	});
});
