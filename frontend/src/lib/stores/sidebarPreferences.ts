import type { Writable } from 'svelte/store';

import { persisted } from './persisted';

/** User customization of the sidebar, persisted to localStorage across sessions. */
export interface SidebarPreferences {
	/** Ids of {@link NavLink} entries the user has hidden from the sidebar. */
	hiddenRoutes: string[];
	/** Ids of {@link NavGroup} entries the user has collapsed. */
	collapsedGroups: string[];
}

const DEFAULT_PREFERENCES: SidebarPreferences = {
	hiddenRoutes: [],
	collapsedGroups: []
};

/**
 * Persisted sidebar customization. Survives logout because it lives in
 * localStorage rather than the auth session.
 */
export const sidebarPreferences: Writable<SidebarPreferences> = persisted(
	'sidebarPreferences',
	DEFAULT_PREFERENCES
);

/** Whether the route with the given id is currently hidden. */
export function isRouteHidden(prefs: SidebarPreferences, routeId: string): boolean {
	return prefs.hiddenRoutes.includes(routeId);
}

/** Returns a new preferences object with the route's hidden state flipped. */
export function toggleRouteHidden(prefs: SidebarPreferences, routeId: string): SidebarPreferences {
	const hiddenRoutes = isRouteHidden(prefs, routeId)
		? prefs.hiddenRoutes.filter((id) => id !== routeId)
		: [...prefs.hiddenRoutes, routeId];
	return { ...prefs, hiddenRoutes };
}

/** Whether the group with the given id is currently collapsed. */
export function isGroupCollapsed(prefs: SidebarPreferences, groupId: string): boolean {
	return prefs.collapsedGroups.includes(groupId);
}

/** Returns a new preferences object with the group's collapsed state flipped. */
export function toggleGroupCollapsed(
	prefs: SidebarPreferences,
	groupId: string
): SidebarPreferences {
	const collapsedGroups = isGroupCollapsed(prefs, groupId)
		? prefs.collapsedGroups.filter((id) => id !== groupId)
		: [...prefs.collapsedGroups, groupId];
	return { ...prefs, collapsedGroups };
}
