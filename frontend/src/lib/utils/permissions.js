/**
 * @typedef {'none' | 'view' | 'edit' | 'full'} AccessLevel
 */

/**
 * @typedef {Object} Permissions
 * @property {Record<string, AccessLevel>} models - Model name to access level mapping
 * @property {Record<string, boolean>} routes - Route pattern to allowed mapping
 * @property {boolean} is_superuser - Whether user is a superuser
 */

/**
 * Check if user can perform an action on a model.
 * @param {Permissions | undefined} permissions
 * @param {string} model - Lowercase model name
 * @param {AccessLevel} requiredLevel - Minimum required access level
 * @returns {boolean}
 */
export function canAccessModel(permissions, model, requiredLevel = 'view') {
	if (!permissions) return false;
	if (permissions.is_superuser) return true;
	if (permissions.models['*'] === 'full') return true;

	const level = permissions.models[model] || 'none';
	const levelOrder = ['none', 'view', 'edit', 'full'];
	return levelOrder.indexOf(level) >= levelOrder.indexOf(requiredLevel);
}

/**
 * Check if user can view a model.
 * @param {Permissions | undefined} permissions
 * @param {string} model
 * @returns {boolean}
 */
export function canView(permissions, model) {
	return canAccessModel(permissions, model, 'view');
}

/**
 * Check if user can edit a model.
 * @param {Permissions | undefined} permissions
 * @param {string} model
 * @returns {boolean}
 */
export function canEdit(permissions, model) {
	return canAccessModel(permissions, model, 'edit');
}

/**
 * Check if user can delete from a model.
 * @param {Permissions | undefined} permissions
 * @param {string} model
 * @returns {boolean}
 */
export function canDelete(permissions, model) {
	return canAccessModel(permissions, model, 'full');
}

/**
 * Check if user can access a route.
 * @param {Permissions | undefined} permissions
 * @param {string} route - The route path (e.g., '/admin/logs')
 * @returns {boolean}
 */
export function canAccessRoute(permissions, route) {
	if (!permissions) return false;
	if (permissions.is_superuser) return true;
	if (permissions.routes['*'] === true) return true;

	// Check for exact match
	if (route in permissions.routes) {
		return permissions.routes[route];
	}

	// Check for wildcard patterns
	for (const [pattern, allowed] of Object.entries(permissions.routes)) {
		if (pattern.endsWith('/*')) {
			const prefix = pattern.slice(0, -1);
			if (route.startsWith(prefix)) {
				return allowed;
			}
		}
	}

	// Default: allow if no specific rule denies it
	return true;
}
