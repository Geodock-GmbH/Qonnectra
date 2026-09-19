/**
 * Node-related serializer shapes shared across the cable/fiber managers and the
 * remote functions that fetch them. Hand-written mirrors of backend payloads,
 * kept out of `./api.d.ts` (which only holds generated OpenAPI types).
 */

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
