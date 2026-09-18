/** A slot configuration row within the container hierarchy. */
export interface SlotConfig {
	uuid: string;
	side: string;
	total_slots: number;
	[key: string]: unknown;
}

export interface ContainerNode {
	uuid: string;
	name?: string;
	display_name?: string;
	container_type_name?: string;
	is_expanded?: boolean;
	children?: ContainerNode[];
	slot_configurations?: SlotConfig[];
}

/** The full hierarchy payload returned by the getContainerHierarchy action. */
export interface Hierarchy {
	containers: ContainerNode[];
	root_slot_configurations: SlotConfig[];
}

/** Payload passed to the move handler when a hierarchy item is dropped. */
export interface MoveDragData {
	type: string;
	uuid: string;
}
