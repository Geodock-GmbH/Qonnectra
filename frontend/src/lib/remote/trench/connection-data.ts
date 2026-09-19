import { API_URL } from '$env/static/private';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { property } from '$lib/remote/shared/json';

/** A trench a conduit runs through, as listed in the conduit assignment table. */
export interface TrenchConnection {
	/** UUID of the trench-conduit connection. */
	uuid: string;
	trenchUuid: string;
	/** The trench's `id_trench`. */
	label: string;
}

/**
 * Reduces the backend's connection rows, which nest the full trench GeoJSON
 * feature, to the lean rows the table renders.
 * @param data - Body of `trench_conduit_connection/all/`.
 * @returns One row per connection that names both itself and its trench.
 */
export function mapTrenchConnections(data: unknown): TrenchConnection[] {
	if (!Array.isArray(data)) return [];

	return data.flatMap((item: unknown): TrenchConnection[] => {
		const uuid = property(item, 'uuid');
		const trench = property(item, 'trench');
		const trenchUuid = property(trench, 'id');
		if (typeof uuid !== 'string' || typeof trenchUuid !== 'string') return [];

		const label = property(property(trench, 'properties'), 'id_trench');
		return [{ uuid, trenchUuid, label: label == null ? '' : String(label) }];
	});
}

/**
 * Picks the trenches a conduit is not connected to yet.
 * @param existing - The conduit's current connections.
 * @param trenchUuids - Trenches that were picked or routed through.
 * @returns The distinct trench UUIDs that still need a connection.
 */
export function newTrenchUuids(existing: TrenchConnection[], trenchUuids: string[]): string[] {
	const connected = new Set(existing.map((connection) => connection.trenchUuid));
	return [...new Set(trenchUuids)].filter((trenchUuid) => !connected.has(trenchUuid));
}

/**
 * Fetches every trench a conduit runs through.
 * @param headers - Django auth headers.
 * @param conduitUuid - UUID of the conduit.
 * @returns The conduit's connections as lean rows.
 * @throws When the backend request fails.
 */
export async function fetchTrenchConnections(
	headers: Record<string, string>,
	conduitUuid: string
): Promise<TrenchConnection[]> {
	const response = await fetch(
		`${API_URL}trench_conduit_connection/all/?uuid_conduit=${encodeURIComponent(conduitUuid)}`,
		{ headers }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to fetch trench connections');

	return mapTrenchConnections(await response.json());
}

/**
 * Connects a conduit to a trench.
 * @param headers - Django auth headers including the JSON content type.
 * @param conduitUuid - UUID of the conduit.
 * @param trenchUuid - UUID of the trench.
 * @throws When the backend rejects the connection.
 */
export async function createConnection(
	headers: Record<string, string>,
	conduitUuid: string,
	trenchUuid: string
): Promise<void> {
	const response = await fetch(`${API_URL}trench_conduit_connection/`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ uuid_conduit: conduitUuid, uuid_trench: trenchUuid })
	});
	if (!response.ok) await failFromResponse(response, 'Failed to create connection');
}

/**
 * Removes a conduit from a trench.
 * @param headers - Django auth headers.
 * @param connectionUuid - UUID of the trench-conduit connection.
 * @throws When the backend rejects the delete.
 */
export async function deleteConnection(
	headers: Record<string, string>,
	connectionUuid: string
): Promise<void> {
	const response = await fetch(
		`${API_URL}trench_conduit_connection/${encodeURIComponent(connectionUuid)}/`,
		{ method: 'DELETE', headers }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to delete connection');
}
