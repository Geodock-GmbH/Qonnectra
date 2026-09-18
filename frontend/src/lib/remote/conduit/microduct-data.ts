/** A microduct as listed by `microduct/all/?uuid_conduit=`. */
export interface Microduct {
	uuid: string;
	name?: string;
	number?: number;
	color?: string;
	hex_code?: string;
	microduct_status?: { id: number; microduct_status: string } | null;
	uuid_node?: {
		properties?: {
			uuid_address?: {
				properties?: {
					street?: string;
					housenumber?: string;
					house_number_suffix?: string;
					zip_code?: string;
					city?: string;
				};
			};
		};
	};
	cable_connection?: { name?: string; type?: string };
	props?: Record<string, unknown>;
}

/** A selectable microduct status. */
export interface MicroductStatusOption {
	id: number;
	microduct_status: string;
}
