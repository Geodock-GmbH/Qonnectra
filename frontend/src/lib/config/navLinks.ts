import type { RouteId } from '$app/types';
import type { ComponentType } from 'svelte';
import { resolve } from '$app/paths';
import {
	IconAbacus,
	IconAiGateway,
	IconAlertTriangle,
	IconArrowRightToArc,
	IconBuildings,
	IconChartArcs,
	IconClipboardText,
	IconFileText,
	IconMapPin,
	IconMapSearch,
	IconSettings,
	IconSTurnRight,
	IconTable,
	IconTopologyBus,
	IconTopologyRing3
} from '@tabler/icons-svelte';

import { m } from '$lib/paraglide/messages';

/** Route params a project link keeps when only the project changes (flags are global). */
export interface ProjectLinkParams {
	flagId?: string;
}

interface NavLinkBase {
	/** Stable identifier: the persistence key for hide/show state and the `{#each}` key. */
	id: string;
	/** The typed route id, single source for the href and the active state. */
	routeId: RouteId;
	/** The key the server guard and the navigation authorise with (see `permissionKeyFor`). */
	permissionKey: string;
	label: () => string;
	/** Tabler icon component rendered next to the label. */
	icon: ComponentType;
}

/** A link into a project-scoped page; its href needs the current project. */
export interface ProjectNavLink extends NavLinkBase {
	scope: 'project';
	href: (projectId: string, params?: ProjectLinkParams) => string;
}

/** A link into a global page. */
export interface GlobalNavLink extends NavLinkBase {
	scope: 'global';
	href: () => string;
}

/** A single navigation entry rendered as a link in the sidebar. */
export type NavLink = ProjectNavLink | GlobalNavLink;

/** A labelled group of navigation entries. */
export interface NavGroup {
	/** Stable identifier used as the persistence key for collapse state. */
	id: string;
	label: () => string;
	/** When true, this group is pinned to the mobile bottom bar instead of the "More" menu. */
	pinnedToBar?: boolean;
	links: NavLink[];
}

/**
 * Sidebar content groups, in display order. The `id` fields are stable strings
 * (not translations) so hide/collapse preferences survive language changes and
 * relabelling. Shared by the desktop sidebar and the mobile navigation so route
 * definitions live in a single place.
 */
export const navGroups: NavGroup[] = [
	{
		id: 'main',
		label: () => m.nav_category_main(),
		pinnedToBar: true,
		links: [
			{
				id: 'dashboard',
				scope: 'project',
				routeId: '/project/[projectId=integer]/dashboard/[[flagId]]',
				permissionKey: '/dashboard',
				label: () => m.nav_dashboard(),
				icon: IconChartArcs,
				href: (projectId, params) =>
					resolve('/project/[projectId=integer]/dashboard/[[flagId]]', {
						projectId,
						flagId: params?.flagId
					})
			},
			{
				id: 'map',
				scope: 'project',
				routeId: '/project/[projectId=integer]/map',
				permissionKey: '/map',
				label: () => m.nav_map(),
				icon: IconMapPin,
				href: (projectId) => resolve('/project/[projectId=integer]/map', { projectId })
			}
		]
	},
	{
		id: 'procedure',
		label: () => m.nav_category_procedure(),
		links: [
			{
				id: 'fault-simulation',
				scope: 'project',
				routeId: '/project/[projectId=integer]/fault-simulation',
				permissionKey: '/fault-simulation',
				label: () => m.nav_fault_simulation(),
				icon: IconAlertTriangle,
				href: (projectId) => resolve('/project/[projectId=integer]/fault-simulation', { projectId })
			},
			{
				id: 'post-compaction',
				scope: 'project',
				routeId: '/project/[projectId=integer]/post-compaction',
				permissionKey: '/post-compaction',
				label: () => m.nav_post_compaction(),
				icon: IconClipboardText,
				href: (projectId) => resolve('/project/[projectId=integer]/post-compaction', { projectId })
			},
			{
				id: 'pipeline-records',
				scope: 'global',
				routeId: '/pipeline-records',
				permissionKey: '/pipeline-records',
				label: () => m.nav_pipeline_records(),
				icon: IconMapSearch,
				href: () => resolve('/pipeline-records')
			},
			{
				id: 'valuation',
				scope: 'project',
				routeId: '/project/[projectId=integer]/valuation',
				permissionKey: '/valuation',
				label: () => m.nav_valuation(),
				icon: IconAbacus,
				href: (projectId) => resolve('/project/[projectId=integer]/valuation', { projectId })
			}
		]
	},
	{
		id: 'infrastructure',
		label: () => m.nav_category_conduit(),
		links: [
			{
				id: 'conduit',
				scope: 'project',
				routeId: '/project/[projectId=integer]/conduit',
				permissionKey: '/conduit',
				label: () => m.nav_conduit_management(),
				icon: IconTable,
				href: (projectId) => resolve('/project/[projectId=integer]/conduit', { projectId })
			},
			{
				id: 'trench',
				scope: 'project',
				routeId: '/project/[projectId=integer]/trench/[[flagId]]',
				permissionKey: '/trench',
				label: () => m.nav_conduit_connection(),
				icon: IconArrowRightToArc,
				href: (projectId, params) =>
					resolve('/project/[projectId=integer]/trench/[[flagId]]', {
						projectId,
						flagId: params?.flagId
					})
			},
			{
				id: 'pipe-branch',
				scope: 'project',
				routeId: '/project/[projectId=integer]/pipe-branch',
				permissionKey: '/pipe-branch',
				label: () => m.nav_pipe_branch(),
				icon: IconAiGateway,
				href: (projectId) => resolve('/project/[projectId=integer]/pipe-branch', { projectId })
			},
			{
				id: 'house-connections',
				scope: 'project',
				routeId: '/project/[projectId=integer]/house-connections',
				permissionKey: '/house-connections',
				label: () => m.nav_house_connections(),
				icon: IconTopologyBus,
				href: (projectId) =>
					resolve('/project/[projectId=integer]/house-connections', { projectId })
			}
		]
	},
	{
		id: 'cable',
		label: () => m.nav_category_cable(),
		links: [
			{
				id: 'network-schema',
				scope: 'project',
				routeId: '/project/[projectId=integer]/network-schema',
				permissionKey: '/network-schema',
				label: () => m.nav_network_schema(),
				icon: IconTopologyRing3,
				href: (projectId) => resolve('/project/[projectId=integer]/network-schema', { projectId })
			},
			{
				id: 'trace',
				scope: 'global',
				routeId: '/trace',
				permissionKey: '/trace',
				label: () => m.nav_fiber_trace(),
				icon: IconSTurnRight,
				href: () => resolve('/trace')
			}
		]
	},
	{
		id: 'address',
		label: () => m.form_building({ count: 2 }),
		links: [
			{
				id: 'address',
				scope: 'project',
				routeId: '/project/[projectId=integer]/address',
				permissionKey: '/address',
				label: () => m.nav_address(),
				icon: IconBuildings,
				href: (projectId) => resolve('/project/[projectId=integer]/address', { projectId })
			}
		]
	}
];

/**
 * Footer navigation entries (logs, settings). Rendered separately from the
 * scrollable content groups and never hidden by the customize controls.
 */
export const footerLinks: NavLink[] = [
	{
		id: 'logs',
		scope: 'global',
		routeId: '/admin/logs',
		permissionKey: '/admin/logs',
		label: () => m.nav_logs(),
		icon: IconFileText,
		href: () => resolve('/admin/logs')
	},
	{
		id: 'settings',
		scope: 'global',
		routeId: '/settings',
		permissionKey: '/settings',
		label: () => m.nav_settings(),
		icon: IconSettings,
		href: () => resolve('/settings')
	}
];

/** Every navigation entry, content groups first. */
export const allNavLinks: NavLink[] = [
	...navGroups.flatMap((group) => group.links),
	...footerLinks
];

/**
 * The href of a link for the current project. On a global page the current
 * project is the remembered one; a user with no project at all is sent to
 * the landing redirect.
 * @param link - The navigation entry.
 * @param projectId - The current or remembered project id, or null when there is none.
 * @param params - Route params to keep, e.g. the flag of a dashboard.
 * @returns The resolved href.
 */
export function navHref(
	link: NavLink,
	projectId: string | null | undefined,
	params?: ProjectLinkParams
): string {
	if (link.scope === 'global') return link.href();
	if (!projectId) return resolve('/');
	return link.href(projectId, params);
}

/**
 * Whether a link is the active one: its route id is the current route or a
 * parent of it (`address/[uuid]` activates the address link).
 * @param link - The navigation entry.
 * @param routeId - The current `page.route.id`.
 * @returns True when the page lies at or beneath the link's route.
 */
export function isActive(link: NavLink, routeId: string | null | undefined): boolean {
	if (!routeId) return false;
	return routeId === link.routeId || routeId.startsWith(`${link.routeId}/`);
}

/**
 * The project link the current route belongs to, used to switch project
 * while staying on the same page.
 * @param routeId - The current `page.route.id`.
 * @returns The project link at or above the route, or undefined on a global page.
 */
export function findProjectLink(routeId: string | null | undefined): ProjectNavLink | undefined {
	return allNavLinks.find(
		(link): link is ProjectNavLink => link.scope === 'project' && isActive(link, routeId)
	);
}
