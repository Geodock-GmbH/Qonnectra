import type { MicropipeConnection } from '$lib/classes/NetworkSchemaState.svelte';

/**
 * Normalise raw `microduct_cable_connection` records into the edge-coloring
 * shape (`{ number, color_hex, color_name }`), falling back to a neutral hex
 * when the microduct has no color code.
 * @param records - Raw connection records from the backend.
 * @returns The normalised connection list.
 */
export function transformMicropipeConnections(
	records: Record<string, unknown>[]
): MicropipeConnection[] {
	return records.map((conn) => {
		const microduct = conn.uuid_microduct as Record<string, unknown> | undefined;
		return {
			number: microduct?.number as number,
			color_hex: (microduct?.hex_code as string) || '#64748b',
			color_name: microduct?.color as string
		};
	});
}
