/** A raw node record as returned by the API (GeoJSON feature or flat node). */
interface RawNodeItem {
	id?: string;
	uuid?: string;
	name?: string;
	properties?: { uuid?: string; name?: string };
}

/**
 * Maps node API responses (GeoJSON, minimal, or flat array) to combobox option format.
 */
export function mapNodesToOptions(nodesData: unknown): { value: string; label: string }[] {
	const bag = nodesData as { features?: RawNodeItem[]; nodes?: RawNodeItem[] } | RawNodeItem[];
	const items: RawNodeItem[] = Array.isArray(bag) ? bag : (bag?.features ?? bag?.nodes ?? []);
	return items.map((item) => {
		const node = item.properties ?? item;
		return {
			value: item.id ?? node.uuid ?? '',
			label: node.name ?? 'Unnamed Node'
		};
	});
}

/**
 * A fiber color as served by the `attributes_fiber_color/` endpoint
 * (`AttributesFiberColorSerializer`). Shared across the cable/fiber managers.
 */
export interface FiberColor {
	/** Database id */
	id: number;
	/** German color name */
	name_de: string;
	/** English color name */
	name_en: string;
	/** Primary hex color code */
	hex_code: string;
	/** Optional secondary hex color code (for striped colors) */
	hex_code_secondary?: string | null;
	/** Sort order */
	display_order: number;
	/** Whether the color is active */
	is_active?: boolean;
	/** Optional description */
	description?: string | null;
}

export interface ComponentPlacement {
	component_type: string;
	slot_start: number;
	port_number: number;
	side: string;
}
