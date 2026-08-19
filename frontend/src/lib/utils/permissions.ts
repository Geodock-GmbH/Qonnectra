export type AccessLevel = 'none' | 'view' | 'edit' | 'full';

export interface Permissions {
	/** Model name to access level mapping. */
	models: Record<string, AccessLevel>;
	/** Route pattern to allowed mapping. */
	routes: Record<string, boolean>;
	/** Whether the user is a superuser. */
	is_superuser: boolean;
}

const LEVEL_ORDER: AccessLevel[] = ['none', 'view', 'edit', 'full'];

/**
 * Checks whether a user has at least the required access level on a model.
 * Superusers and wildcard `*: full` always pass.
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name (e.g., 'trench', 'node').
 * @param requiredLevel - Minimum required access level.
 */
export function canAccessModel(
	permissions: Permissions | undefined,
	model: string,
	requiredLevel: AccessLevel = 'view'
): boolean {
	if (!permissions) return false;
	if (permissions.is_superuser) return true;
	if (permissions.models['*'] === 'full') return true;

	const level = permissions.models[model] || 'none';
	return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(requiredLevel);
}

/**
 * Checks whether a user can view a model.
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name.
 */
export function canView(permissions: Permissions | undefined, model: string): boolean {
	return canAccessModel(permissions, model, 'view');
}

/**
 * Checks whether a user can edit a model.
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name.
 */
export function canEdit(permissions: Permissions | undefined, model: string): boolean {
	return canAccessModel(permissions, model, 'edit');
}

/**
 * Checks whether a user can delete from a model (requires 'full' access).
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name.
 */
export function canDelete(permissions: Permissions | undefined, model: string): boolean {
	return canAccessModel(permissions, model, 'full');
}

/**
 * Checks whether a user can access a given route.
 * Supports exact matches, wildcard patterns (e.g., '/admin/*'), and defaults to allow.
 * @param permissions - The user's permissions object.
 * @param route - The route path (e.g., '/admin/logs').
 */
export function canAccessRoute(permissions: Permissions | undefined, route: string): boolean {
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
