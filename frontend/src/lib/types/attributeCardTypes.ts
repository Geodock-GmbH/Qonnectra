/**
 * Shared types for the network-schema attribute cards (node & edge), which read
 * the `attributeOptions` context and the drawer's node/edge props.
 *
 * The generic form-action helper `actionData` lives in `$lib/utils/forms`.
 */

/**
 * Minimal structural contract for GenericCombobox's `data` items. Kept free of
 * an index signature so any named option interface with `{ value, label }`
 * qualifies (interfaces have no implicit index signature and would otherwise
 * fail to assign). `value` allows numbers: the server loads map raw API ids
 * (`value: item.id`) into these rows; the combobox widget coerces to string.
 */
export interface ComboboxItem {
	value: string | number;
	label: string;
}

/** A `{ value, label }` option as rendered by the comboboxes. */
export interface ComboboxOption {
	value: string;
	label: string;
	[key: string]: unknown;
}

/** A foreign-key reference embedded in a node/edge payload. */
export interface FkRef {
	id?: number | string;
	uuid?: string;
	[key: string]: unknown;
}

/** The option lists provided via the `attributeOptions` context. */
export interface AttributeOptions {
	nodeTypes?: ComboboxOption[];
	cableTypes?: ComboboxOption[];
	conduitTypes?: ComboboxOption[];
	statuses?: ComboboxOption[];
	networkLevels?: ComboboxOption[];
	companies?: ComboboxOption[];
	flags?: ComboboxOption[];
	excludedNodeTypeIds?: (number | string)[];
	childViewEnabledNodeTypeIds?: (number | string)[];
	parentNodeOptions?: ComboboxOption[];
	[key: string]: unknown;
}

/** Drawer props for a network-schema edge (cable) attribute card. */
export interface CableDrawerProps {
	uuid?: string;
	name?: string;
	cable_type?: FkRef | null;
	status?: FkRef | null;
	network_level?: FkRef | null;
	owner?: FkRef | null;
	constructor?: FkRef | null;
	manufacturer?: FkRef | null;
	flag?: FkRef | null;
	date?: string | null;
	fiber_count?: number | null;
	length?: number | null;
	length_total?: number | null;
	reserve_at_start?: number | null;
	reserve_at_end?: number | null;
	reserve_section?: number | null;
	handle_start?: string | null;
	handle_end?: string | null;
	uuid_node_start?: string | null;
	uuid_node_end?: string | null;
	[key: string]: unknown;
}

/** Drawer props for a conduit attribute card. */
export interface ConduitDrawerProps {
	uuid?: string;
	name?: string;
	outer_conduit?: string | null;
	conduit_type?: FkRef | null;
	status?: FkRef | null;
	network_level?: FkRef | null;
	owner?: FkRef | null;
	constructor?: FkRef | null;
	manufacturer?: FkRef | null;
	flag?: FkRef | null;
	date?: string | null;
	[key: string]: unknown;
}

/** Drawer props for a network-schema node attribute card. */
export interface NodeDrawerProps {
	id?: string;
	name?: string;
	node_type?: FkRef | null;
	status?: FkRef | null;
	network_level?: FkRef | null;
	owner?: FkRef | null;
	constructor?: FkRef | null;
	manufacturer?: FkRef | null;
	flag?: FkRef | null;
	warranty?: string | null;
	date?: string | null;
	parent_node?: FkRef | null;
	[key: string]: unknown;
}
