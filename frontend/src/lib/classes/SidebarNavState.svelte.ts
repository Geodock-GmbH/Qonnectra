import type { NavGroup, NavLink } from '$lib/config/navLinks';
import { fromStore } from 'svelte/store';
import { page } from '$app/state';

import {
	isGroupCollapsed,
	isRouteHidden,
	sidebarPreferences,
	toggleGroupCollapsed,
	toggleRouteHidden
} from '$lib/stores/sidebarPreferences';
import { canAccessRoute } from '$lib/utils/permissions';
import { footerLinks, navGroups } from '$lib/config/navLinks';

const preferences = fromStore(sidebarPreferences);

/**
 * Navigation state shared by the desktop sidebar and the mobile "More" sheet:
 * the routes the user may access, the persisted hide/collapse customization and
 * the per-instance customize mode.
 */
export class SidebarNavState {
	/** Whether the customize controls (per-route hide toggles, reset) are shown. */
	customizing = $state(false);

	/**
	 * Content groups filtered to the routes the current user may access. Hidden
	 * routes are kept here so they can still be revealed while customizing.
	 */
	permittedGroups: NavGroup[] = $derived(
		navGroups
			.map((group) => ({
				...group,
				links: group.links.filter((link) =>
					canAccessRoute(page.data.user?.permissions, link.permissionKey)
				)
			}))
			.filter((group) => group.links.length > 0)
	);

	/** System links (logs, settings) the current user may access; never hideable. */
	permittedFooterLinks: NavLink[] = $derived(
		footerLinks.filter((link) => canAccessRoute(page.data.user?.permissions, link.permissionKey))
	);

	/**
	 * @param routeId - Stable id of the route
	 * @returns Whether the user has hidden the route
	 */
	isHidden(routeId: string): boolean {
		return isRouteHidden(preferences.current, routeId);
	}

	/**
	 * @param groupId - Stable id of the group
	 * @returns Whether the user has collapsed the group
	 */
	isCollapsed(groupId: string): boolean {
		return isGroupCollapsed(preferences.current, groupId);
	}

	/**
	 * Links of a group to render: all of them while customizing, otherwise only
	 * the ones the user has not hidden.
	 * @param group - Permitted group to list
	 * @returns The links to render
	 */
	visibleLinks(group: NavGroup): NavLink[] {
		return this.customizing ? group.links : group.links.filter((link) => !this.isHidden(link.id));
	}

	/** Enters or leaves customize mode for this navigation only. */
	toggleCustomizing() {
		this.customizing = !this.customizing;
	}

	/** @param groupId - Stable id of the group to expand/collapse */
	toggleGroup(groupId: string) {
		sidebarPreferences.update((prefs) => toggleGroupCollapsed(prefs, groupId));
	}

	/** @param routeId - Stable id of the route to hide/show */
	toggleRoute(routeId: string) {
		sidebarPreferences.update((prefs) => toggleRouteHidden(prefs, routeId));
	}

	/** Clears all hidden routes and collapsed groups back to defaults. */
	reset() {
		sidebarPreferences.set({ hiddenRoutes: [], collapsedGroups: [] });
	}
}
