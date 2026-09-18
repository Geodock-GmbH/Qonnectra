/** A conduit running through a trench, as listed by `trench_conduit_connection/all/`. */
export interface TrenchConduit {
	uuid: string;
	conduit?: {
		uuid?: string;
		name?: string;
		conduit_type?: { conduit_type?: string } | null;
	} | null;
}

/** A cable passing through a trench, as listed by `cable/in-trench/`. */
export interface TrenchCable {
	uuid: string;
	name?: string;
	cable_type?: { cable_type?: string } | null;
	fiber_count?: number;
}

/** A microduct as drawn inside a conduit of the trench profile. */
export interface TrenchProfileMicroduct {
	uuid: string;
	color?: string;
	hex_code?: string | null;
	hex_code_secondary?: string | null;
	is_two_layer?: boolean;
	status?: unknown;
}

/** A conduit of the trench profile with its saved canvas placement, if any. */
export interface TrenchProfileConduit {
	conduit_uuid: string;
	conduit_name: string;
	conduit_type: string;
	microducts: TrenchProfileMicroduct[];
	has_saved_position: boolean;
	canvas_x: number | null;
	canvas_y: number | null;
	canvas_width: number | null;
	canvas_height: number | null;
}

/**
 * Builds the display title of a conduit in a trench: its name with the conduit
 * type in brackets, or a short-UUID placeholder for an unnamed conduit.
 * @param item - The trench-conduit connection.
 * @returns The title shown in the conduit overview.
 */
export function trenchConduitTitle(item: TrenchConduit): string {
	const name = item.conduit?.name;
	if (!name) return `Conduit ${item.uuid.slice(0, 8)}`;

	const type = item.conduit?.conduit_type?.conduit_type;
	return type ? `${name} (${type})` : name;
}

/**
 * Builds the display title of a cable in a trench: its name with the cable
 * type in brackets, or a short-UUID placeholder for an unnamed cable.
 * @param cable - The cable.
 * @returns The title shown in the cable overview.
 */
export function trenchCableTitle(cable: TrenchCable): string {
	if (!cable.name) return `Cable ${cable.uuid.slice(0, 8)}`;

	const type = cable.cable_type?.cable_type;
	return type ? `${cable.name} (${type})` : cable.name;
}
