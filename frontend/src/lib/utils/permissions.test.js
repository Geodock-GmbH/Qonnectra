import { describe, expect, it } from 'vitest';

import { canAccessModel, canAccessRoute, canDelete, canEdit, canView } from './permissions.js';

/**
 * @typedef {import('./permissions.js').Permissions} Permissions
 */

describe('canAccessModel', () => {
	it('returns false for undefined permissions', () => {
		expect(canAccessModel(undefined, 'trench')).toBe(false);
	});

	it('returns true for superuser', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: true, models: {}, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'full')).toBe(true);
	});

	it('returns true for wildcard full access', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { '*': 'full' }, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'full')).toBe(true);
	});

	it('returns true when access level meets requirement', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'edit' }, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'view')).toBe(true);
		expect(canAccessModel(permissions, 'trench', 'edit')).toBe(true);
		expect(canAccessModel(permissions, 'trench', 'full')).toBe(false);
	});

	it('returns false when model has no permission', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: {}, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'view')).toBe(false);
	});
});

describe('canView', () => {
	it('returns true for view level', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'view' }, routes: {} };
		expect(canView(permissions, 'trench')).toBe(true);
	});

	it('returns true for higher levels', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'full' }, routes: {} };
		expect(canView(permissions, 'trench')).toBe(true);
	});
});

describe('canEdit', () => {
	it('returns false for view level', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'view' }, routes: {} };
		expect(canEdit(permissions, 'trench')).toBe(false);
	});

	it('returns true for edit level', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'edit' }, routes: {} };
		expect(canEdit(permissions, 'trench')).toBe(true);
	});
});

describe('canDelete', () => {
	it('returns false for edit level', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'edit' }, routes: {} };
		expect(canDelete(permissions, 'trench')).toBe(false);
	});

	it('returns true for full level', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: { trench: 'full' }, routes: {} };
		expect(canDelete(permissions, 'trench')).toBe(true);
	});
});

describe('canAccessRoute', () => {
	it('returns false for undefined permissions', () => {
		expect(canAccessRoute(undefined, '/admin/logs')).toBe(false);
	});

	it('returns true for superuser', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: true, models: {}, routes: {} };
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(true);
	});

	it('returns true for wildcard route access', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: {}, routes: { '*': true } };
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(true);
	});

	it('returns value for exact match', () => {
		/** @type {Permissions} */
		const permissions = {
			is_superuser: false,
			models: {},
			routes: { '/admin/logs': false }
		};
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(false);
	});

	it('matches wildcard patterns', () => {
		/** @type {Permissions} */
		const permissions = {
			is_superuser: false,
			models: {},
			routes: { '/admin/*': false }
		};
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(false);
		expect(canAccessRoute(permissions, '/admin/users')).toBe(false);
		expect(canAccessRoute(permissions, '/map')).toBe(true);
	});

	it('returns true by default for unknown routes', () => {
		/** @type {Permissions} */
		const permissions = { is_superuser: false, models: {}, routes: {} };
		expect(canAccessRoute(permissions, '/some/unknown/route')).toBe(true);
	});
});
