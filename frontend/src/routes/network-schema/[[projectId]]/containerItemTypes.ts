export interface ContainerNode {
	uuid: string;
	name?: string;
	display_name?: string;
	container_type_name?: string;
	is_expanded?: boolean;
	children?: ContainerNode[];
	slot_configurations?: Array<{ uuid: string } & Record<string, unknown>>;
}
