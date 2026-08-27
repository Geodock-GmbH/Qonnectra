import type { ComponentType } from 'svelte';
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

/** A single navigation entry rendered as a link in the sidebar. */
export interface NavLink {
	/** Stable identifier used as the persistence key for hide/show state. */
	id: string;
	href: string;
	label: () => string;
	/** Tabler icon component rendered next to the label. */
	icon: ComponentType;
	pathMatch: (path: string) => boolean;
}

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
				href: '/dashboard',
				label: () => m.nav_dashboard(),
				icon: IconChartArcs,
				pathMatch: (path) => path.startsWith('/dashboard')
			},
			{
				id: 'map',
				href: '/map',
				label: () => m.nav_map(),
				icon: IconMapPin,
				pathMatch: (path) => path.startsWith('/map')
			}
		]
	},
	{
		id: 'procedure',
		label: () => m.nav_category_procedure(),
		links: [
			{
				id: 'fault-simulation',
				href: '/fault-simulation',
				label: () => m.nav_fault_simulation(),
				icon: IconAlertTriangle,
				pathMatch: (path) => path.startsWith('/fault-simulation')
			},
			{
				id: 'post-compaction',
				href: '/post-compaction',
				label: () => m.nav_post_compaction(),
				icon: IconClipboardText,
				pathMatch: (path) => path.startsWith('/post-compaction')
			},
			{
				id: 'pipeline-records',
				href: '/pipeline-records',
				label: () => m.nav_pipeline_records(),
				icon: IconMapSearch,
				pathMatch: (path) => path.startsWith('/pipeline-records')
			},
			{
				id: 'valuation',
				href: '/valuation',
				label: () => m.nav_valuation(),
				icon: IconAbacus,
				pathMatch: (path) => path.startsWith('/valuation')
			}
		]
	},
	{
		id: 'infrastructure',
		label: () => m.nav_category_conduit(),
		links: [
			{
				id: 'conduit',
				href: '/conduit',
				label: () => m.nav_conduit_management(),
				icon: IconTable,
				pathMatch: (path) => path.startsWith('/conduit')
			},
			{
				id: 'trench',
				href: '/trench',
				label: () => m.nav_conduit_connection(),
				icon: IconArrowRightToArc,
				pathMatch: (path) => path.startsWith('/trench')
			},
			{
				id: 'pipe-branch',
				href: '/pipe-branch',
				label: () => m.nav_pipe_branch(),
				icon: IconAiGateway,
				pathMatch: (path) => path.startsWith('/pipe-branch')
			},
			{
				id: 'house-connections',
				href: '/house-connections',
				label: () => m.nav_house_connections(),
				icon: IconTopologyBus,
				pathMatch: (path) => path.startsWith('/house-connections')
			}
		]
	},
	{
		id: 'cable',
		label: () => m.nav_category_cable(),
		links: [
			{
				id: 'network-schema',
				href: '/network-schema',
				label: () => m.nav_network_schema(),
				icon: IconTopologyRing3,
				pathMatch: (path) => path.startsWith('/network-schema')
			},
			{
				id: 'trace',
				href: '/trace',
				label: () => m.nav_fiber_trace(),
				icon: IconSTurnRight,
				pathMatch: (path) => path.startsWith('/trace')
			}
		]
	},
	{
		id: 'address',
		label: () => m.form_building({ count: 2 }),
		links: [
			{
				id: 'address',
				href: '/address',
				label: () => m.nav_address(),
				icon: IconBuildings,
				pathMatch: (path) => path.startsWith('/address')
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
		href: '/admin/logs',
		label: () => m.nav_logs(),
		icon: IconFileText,
		pathMatch: (path) => path === '/admin/logs'
	},
	{
		id: 'settings',
		href: '/settings',
		label: () => m.nav_settings(),
		icon: IconSettings,
		pathMatch: (path) => path.startsWith('/settings')
	}
];
