/**
 * @typedef {'none' | 'view' | 'edit' | 'full'} AccessLevel
 */

/**
 * @typedef {Object} Permissions
 * @property {Record<string, AccessLevel>} models - Model name to access level mapping.
 * @property {Record<string, boolean>} routes - Route pattern to allowed mapping.
 * @property {boolean} is_superuser - Whether the user is a superuser.
 */

/** @type {AccessLevel[]} */
const LEVEL_ORDER = ['none', 'view', 'edit', 'full'];

/**
 * Checks whether a user has at least the required access level on a model.
 * Superusers and wildcard `*: full` always pass.
 * @param {Permissions | undefined} permissions - The user's permissions object.
 * @param {string} model - Lowercase model name (e.g., 'trench', 'node').
 * @param {AccessLevel} [requiredLevel='view'] - Minimum required access level.
 * @returns {boolean} Whether the user meets or exceeds the required level.
 */
export function canAccessModel(permissions, model, requiredLevel = 'view') {
	if (!permissions) return false;
	if (permissions.is_superuser) return true;
	if (permissions.models['*'] === 'full') return true;

	const level = permissions.models[model] || 'none';
	return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(requiredLevel);
}

/**
 * Checks whether a user can view a model.
 * @param {Permissions | undefined} permissions - The user's permissions object.
 * @param {string} model - Lowercase model name.
 * @returns {boolean} Whether the user has at least 'view' access.
 */
export function canView(permissions, model) {
	return canAccessModel(permissions, model, 'view');
}

/**
 * Checks whether a user can edit a model.
 * @param {Permissions | undefined} permissions - The user's permissions object.
 * @param {string} model - Lowercase model name.
 * @returns {boolean} Whether the user has at least 'edit' access.
 */
export function canEdit(permissions, model) {
	return canAccessModel(permissions, model, 'edit');
}

/**
 * Checks whether a user can delete from a model (requires 'full' access).
 * @param {Permissions | undefined} permissions - The user's permissions object.
 * @param {string} model - Lowercase model name.
 * @returns {boolean} Whether the user has 'full' access.
 */
export function canDelete(permissions, model) {
	return canAccessModel(permissions, model, 'full');
}

/**
 * Checks whether a user can access a given route.
 * Supports exact matches, wildcard patterns (e.g., '/admin/*'), and defaults to allow.
 * @param {Permissions | undefined} permissions - The user's permissions object.
 * @param {string} route - The route path (e.g., '/admin/logs').
 * @returns {boolean} Whether the user can access the route.
 */
export function canAccessRoute(permissions, route) {
	if (!permissions) return false;
	if (permissions.is_superuser) return true;
	if (permissions.routes['*'] === true) return true;

	if (route in permissions.routes) {
		return permissions.routes[route];
	}

	for (const [pattern, allowed] of Object.entries(permissions.routes)) {
		if (pattern.endsWith('/*')) {
			const prefix = pattern.slice(0, -1);
			if (route.startsWith(prefix)) {
				return allowed;
			}
		}
	}

	return true;
}
