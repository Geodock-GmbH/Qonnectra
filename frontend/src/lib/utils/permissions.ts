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
 * Superusers always pass; a model without its own entry takes the `*` level,
 * as the backend resolves it.
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name (e.g., 'trench', 'node').
 * @param requiredLevel - Minimum required access level.
 * @returns Whether the user's level on the model reaches the required one; false without permissions.
 */
export function canAccessModel(
	permissions: Permissions | undefined,
	model: string,
	requiredLevel: AccessLevel = 'view'
): boolean {
	if (!permissions) return false;
	if (permissions.is_superuser) return true;

	const level = permissions.models[model] ?? permissions.models['*'] ?? 'none';
	return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(requiredLevel);
}

/**
 * Checks whether a user can view a model.
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name.
 * @returns Whether the user has at least view access.
 */
export function canView(permissions: Permissions | undefined, model: string): boolean {
	return canAccessModel(permissions, model, 'view');
}

/**
 * Checks whether a user can edit a model.
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name.
 * @returns Whether the user has at least edit access.
 */
export function canEdit(permissions: Permissions | undefined, model: string): boolean {
	return canAccessModel(permissions, model, 'edit');
}

/**
 * Checks whether a user can delete from a model (requires 'full' access).
 * @param permissions - The user's permissions object.
 * @param model - Lowercase model name.
 * @returns Whether the user has full access.
 */
export function canDelete(permissions: Permissions | undefined, model: string): boolean {
	return canAccessModel(permissions, model, 'full');
}

/**
 * The part of the key space a route pattern covers, as a prefix: `/admin/*`
 * and `/admin` both cover everything beneath `/admin/`, `/*` covers every key.
 * A longer prefix is a more specific pattern.
 * @param pattern - A route pattern from the user's permissions.
 * @returns The prefix a covered key starts with.
 */
function coveredPrefix(pattern: string): string {
	return pattern.endsWith('/*') ? pattern.slice(0, -1) : `${pattern}/`;
}

/**
 * Checks whether a user may open the page behind a permission key (a route
 * id with the project prefix and parameters stripped, see
 * `permissionKeyFor`). An exact pattern for the key decides; otherwise the
 * most specific pattern covering it (ending in `/*`, or a key the page lies
 * beneath: `/valuation` also covers `/valuation/...`), so `/address` beats
 * `/*` for `/address/unit`. Between equally specific patterns allowing wins,
 * as it does across roles. Missing permissions allow: they mean the
 * permissions request failed, and a Django hiccup must not lock everyone out.
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

	let decidingLength = -1;
	let allowed = true;
	for (const [pattern, patternAllowed] of Object.entries(routes)) {
		const prefix = coveredPrefix(pattern);
		if (!key.startsWith(prefix)) continue;
		if (prefix.length > decidingLength) {
			decidingLength = prefix.length;
			allowed = patternAllowed;
		} else if (prefix.length === decidingLength) {
			allowed ||= patternAllowed;
		}
	}

	return allowed;
}
