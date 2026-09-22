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
 * Checks whether a user may open the page behind a permission key (a route
 * id with the project prefix and parameters stripped, see
 * `permissionKeyFor`). A pattern matches the key when it is equal, when it
 * ends in `/*` and the key starts with that prefix, or when the key lies
 * beneath it (`/valuation` also covers `/valuation/...`). Missing
 * permissions allow: they mean the permissions request failed, and a Django
 * hiccup must not lock everyone out.
 * @param permissions - The user's permissions, or nothing when they could not be loaded.
 * @param key - The permission key of the page.
 * @returns Whether the page may be opened; unknown keys are allowed.
 */
export function canAccessRoute(permissions: Permissions | null | undefined, key: string): boolean {
	if (!permissions) return true;
	if (permissions.is_superuser) return true;
	const routes = permissions.routes ?? {};
	if (routes['*'] === true) return true;
	if (key in routes) return routes[key];

	for (const [pattern, allowed] of Object.entries(routes)) {
		const covers = pattern.endsWith('/*')
			? key.startsWith(pattern.slice(0, -1))
			: key.startsWith(`${pattern}/`);
		if (covers) return allowed;
	}

	return true;
}
