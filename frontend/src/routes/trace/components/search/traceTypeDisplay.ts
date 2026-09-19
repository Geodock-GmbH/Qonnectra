import type { Icon } from '@tabler/icons-svelte';
import type { TraceEntryType } from '$lib/remote/trace/trace-data';
import {
	IconBuildings,
	IconMapPin,
	IconPlug,
	IconRouter,
	IconSTurnRight
} from '@tabler/icons-svelte';

import { m } from '$lib/paraglide/messages';

/** How an entry type presents itself on the search page. */
export interface TraceTypeDisplay {
	label: () => string;
	icon: Icon;
	/** Text color class of the icon. */
	color: string;
	searchPlaceholder: () => string;
}

/** Presentation of every entry type, in tab order. */
export const TRACE_TYPE_DISPLAY: Record<TraceEntryType, TraceTypeDisplay> = {
	address: {
		label: () => m.form_address({ count: 1 }),
		icon: IconMapPin,
		color: 'text-error-500',
		searchPlaceholder: () => m.trace_search_address_placeholder()
	},
	node: {
		label: () => m.form_node(),
		icon: IconRouter,
		color: 'text-success-500',
		searchPlaceholder: () => m.trace_search_node_placeholder()
	},
	cable: {
		label: () => m.form_cables(),
		icon: IconPlug,
		color: 'text-warning-500',
		searchPlaceholder: () => m.trace_search_cable_placeholder()
	},
	residential_unit: {
		label: () => m.form_residential_units(),
		icon: IconBuildings,
		color: 'text-secondary-500',
		searchPlaceholder: () => m.trace_search_ru_placeholder()
	},
	fiber: {
		label: () => m.form_fiber(),
		icon: IconSTurnRight,
		color: 'text-primary-500',
		searchPlaceholder: () => m.trace_search_cable_placeholder()
	}
};
