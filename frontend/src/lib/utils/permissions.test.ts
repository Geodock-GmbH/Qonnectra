import type { Permissions } from './permissions';
import { describe, expect, it } from 'vitest';

import { canAccessModel, canAccessRoute, canDelete, canEdit, canView } from './permissions';

describe('canAccessModel', () => {
	it('returns false for undefined permissions', () => {
		expect(canAccessModel(undefined, 'trench')).toBe(false);
	});

	it('returns true for superuser', () => {
		const permissions: Permissions = { is_superuser: true, models: {}, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'full')).toBe(true);
	});

	it('returns true for wildcard full access', () => {
		const permissions: Permissions = { is_superuser: false, models: { '*': 'full' }, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'full')).toBe(true);
	});

	it('returns true when access level meets requirement', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'edit' },
			routes: {}
		};
		expect(canAccessModel(permissions, 'trench', 'view')).toBe(true);
		expect(canAccessModel(permissions, 'trench', 'edit')).toBe(true);
		expect(canAccessModel(permissions, 'trench', 'full')).toBe(false);
	});

	it('returns false when model has no permission', () => {
		const permissions: Permissions = { is_superuser: false, models: {}, routes: {} };
		expect(canAccessModel(permissions, 'trench', 'view')).toBe(false);
	});

	it('falls back to the wildcard level for models without their own entry', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { '*': 'view', cable: 'none' },
			routes: {}
		};
		expect(canAccessModel(permissions, 'trench', 'view')).toBe(true);
		expect(canAccessModel(permissions, 'trench', 'edit')).toBe(false);
		expect(canAccessModel(permissions, 'cable', 'view')).toBe(false);
	});
});

describe('canView', () => {
	it('returns true for view level', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'view' },
			routes: {}
		};
		expect(canView(permissions, 'trench')).toBe(true);
	});

	it('returns true for higher levels', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'full' },
			routes: {}
		};
		expect(canView(permissions, 'trench')).toBe(true);
	});
});

describe('canEdit', () => {
	it('returns false for view level', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'view' },
			routes: {}
		};
		expect(canEdit(permissions, 'trench')).toBe(false);
	});

	it('returns true for edit level', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'edit' },
			routes: {}
		};
		expect(canEdit(permissions, 'trench')).toBe(true);
	});
});

describe('canDelete', () => {
	it('returns false for edit level', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'edit' },
			routes: {}
		};
		expect(canDelete(permissions, 'trench')).toBe(false);
	});

	it('returns true for full level', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: { trench: 'full' },
			routes: {}
		};
		expect(canDelete(permissions, 'trench')).toBe(true);
	});
});

describe('canAccessRoute', () => {
	it('allows everything when the permissions could not be loaded', () => {
		expect(canAccessRoute(undefined, '/admin/logs')).toBe(true);
		expect(canAccessRoute(null, '/admin/logs')).toBe(true);
	});

	it('lets an exact row cover its sub-routes', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/valuation': false }
		};
		expect(canAccessRoute(permissions, '/valuation')).toBe(false);
		expect(canAccessRoute(permissions, '/valuation/areas')).toBe(false);
		expect(canAccessRoute(permissions, '/valuations')).toBe(true);
	});

	it('returns true for superuser', () => {
		const permissions: Permissions = { is_superuser: true, models: {}, routes: {} };
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(true);
	});

	it('lets the most specific pattern win, whatever the row order', () => {
		const denyFirst: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/*': false, '/address': true }
		};
		const allowFirst: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/address': true, '/*': false }
		};
		for (const permissions of [denyFirst, allowFirst]) {
			expect(canAccessRoute(permissions, '/address/unit')).toBe(true);
			expect(canAccessRoute(permissions, '/valuation')).toBe(false);
		}
	});

	it('lets a narrower deny beat a broader allow', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/*': true, '/network-schema': false }
		};
		expect(canAccessRoute(permissions, '/network-schema/node')).toBe(false);
		expect(canAccessRoute(permissions, '/map')).toBe(true);
	});

	it('lets allowing win between equally specific patterns', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/admin/*': false, '/admin': true }
		};
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(true);
	});

	it('returns true for wildcard route access', () => {
		const permissions: Permissions = { is_superuser: false, models: {}, routes: { '*': true } };
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(true);
	});

	it('returns value for exact match', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/admin/logs': false }
		};
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(false);
	});

	it('matches wildcard patterns', () => {
		const permissions: Permissions = {
			is_superuser: false,
			models: {},
			routes: { '/admin/*': false }
		};
		expect(canAccessRoute(permissions, '/admin/logs')).toBe(false);
		expect(canAccessRoute(permissions, '/admin/users')).toBe(false);
		expect(canAccessRoute(permissions, '/map')).toBe(true);
	});

	it('returns true by default for unknown routes', () => {
		const permissions: Permissions = { is_superuser: false, models: {}, routes: {} };
		expect(canAccessRoute(permissions, '/some/unknown/route')).toBe(true);
	});
});
