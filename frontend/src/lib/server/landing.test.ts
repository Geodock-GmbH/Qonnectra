import { describe, expect, test } from 'vitest';

import { resolveLandingPath } from './landing';

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
