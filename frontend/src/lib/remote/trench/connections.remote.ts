import type { TrenchConnection } from './connection-data';
import { command, query } from '$app/server';
import * as v from 'valibot';

import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import {
	createConnection,
	deleteConnection,
	fetchTrenchConnections,
	newTrenchUuids
} from './connection-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const CreateConnectionsSchema = v.object({
	conduitUuid: UuidSchema,
	trenchUuids: v.pipe(v.array(UuidSchema), v.minLength(1))
});

const DeleteConnectionSchema = v.object({
	conduitUuid: UuidSchema,
	connectionUuid: UuidSchema
});

/**
 * Fetch the trenches a conduit runs through.
 * @param conduitUuid - Conduit UUID.
 * @returns The conduit's trench connections.
 * @throws When the backend request fails.
 */
export const getTrenchConnections = query(
	UuidSchema,
	async (conduitUuid): Promise<TrenchConnection[]> =>
		fetchTrenchConnections(djangoHeaders(), conduitUuid)
);

/**
 * Connect a conduit to every listed trench it does not run through yet and
 * refresh its connection list in the same flight. The list is refreshed even
 * when some trenches were rejected, so the ones that were saved show up.
 * @param input.conduitUuid - Conduit UUID, whose `getTrenchConnections` instance is refreshed.
 * @param input.trenchUuids - Trenches picked on the map or traversed by a route.
 * @returns How many connections were created; `0` when all of them existed.
 * @throws When the backend rejects one of the connections.
 */
export const createTrenchConnections = command(
	CreateConnectionsSchema,
	async ({ conduitUuid, trenchUuids }): Promise<{ created: number }> => {
		const headers = djangoHeaders(true);
		const existing = await fetchTrenchConnections(headers, conduitUuid);
		const missing = newTrenchUuids(existing, trenchUuids);
		if (missing.length === 0) return { created: 0 };

		const results = await Promise.allSettled(
			missing.map((trenchUuid) => createConnection(headers, conduitUuid, trenchUuid))
		);
		await getTrenchConnections(conduitUuid).refresh();

		const rejected = results.find((result) => result.status === 'rejected');
		if (rejected) throw rejected.reason;

		return { created: missing.length };
	}
);

/**
 * Remove a conduit from a trench and refresh its connection list in the same
 * flight.
 * @param input.conduitUuid - Conduit UUID, whose `getTrenchConnections` instance is refreshed.
 * @param input.connectionUuid - UUID of the trench-conduit connection.
 * @throws When the backend rejects the delete.
 */
export const deleteTrenchConnection = command(
	DeleteConnectionSchema,
	async ({ conduitUuid, connectionUuid }): Promise<void> => {
		const headers = djangoHeaders();
		await deleteConnection(headers, connectionUuid);
		await getTrenchConnections(conduitUuid).refresh();
	}
);
