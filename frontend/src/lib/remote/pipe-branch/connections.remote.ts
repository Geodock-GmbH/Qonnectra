import type { BranchConnection, ConnectionBatchResult } from './connection-data';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { createConnectionBatch, toBranchConnections } from './connection-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const MicroductEndSchema = v.object({
	microductUuid: UuidSchema,
	trenchUuid: UuidSchema
});

const MicroductPairSchema = v.pipe(
	v.object({ from: MicroductEndSchema, to: MicroductEndSchema }),
	v.check(
		({ from, to }) => from.microductUuid !== to.microductUuid,
		'Cannot connect a microduct to itself'
	)
);

const CreateConnectionsSchema = v.object({
	nodeUuid: UuidSchema,
	pairs: v.pipe(v.array(MicroductPairSchema), v.minLength(1))
});

const DeleteConnectionSchema = v.object({
	uuid: UuidSchema,
	nodeUuid: UuidSchema
});

/**
 * Fetch the microduct connections made at a pipe-branch node.
 * @param nodeUuid - Pipe-branch node UUID.
 * @returns The node's connections.
 * @throws When the backend request fails.
 */
export const getConnections = query(UuidSchema, async (nodeUuid): Promise<BranchConnection[]> => {
	const response = await fetch(
		`${API_URL}microduct_connection/all_connections/?uuid_node=${encodeURIComponent(nodeUuid)}`,
		{ headers: djangoHeaders() }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to fetch connections');

	return toBranchConnections(await response.json());
});

/**
 * Connect microduct pairs at a node and refresh the node's connections in the
 * same flight. Pairs the backend rejects are reported, not thrown.
 * @param input.nodeUuid - Pipe-branch node the microducts are joined at.
 * @param input.pairs - The microduct pairs to connect.
 * @returns How many connections were created and why the others were not.
 */
export const createConnections = command(
	CreateConnectionsSchema,
	async ({ nodeUuid, pairs }): Promise<ConnectionBatchResult> => {
		const result = await createConnectionBatch(djangoHeaders(true), nodeUuid, pairs);
		await getConnections(nodeUuid).refresh();
		return result;
	}
);

/**
 * Delete a microduct connection and refresh its node's connections in the same flight.
 * @param input.uuid - Connection UUID.
 * @param input.nodeUuid - Pipe-branch node, whose `getConnections` instance is refreshed.
 * @throws When the backend rejects the delete.
 */
export const deleteConnection = command(
	DeleteConnectionSchema,
	async ({ uuid, nodeUuid }): Promise<void> => {
		const response = await fetch(`${API_URL}microduct_connection/${encodeURIComponent(uuid)}/`, {
			method: 'DELETE',
			headers: djangoHeaders()
		});
		if (!response.ok) await failFromResponse(response, 'Failed to delete connection');

		await getConnections(nodeUuid).refresh();
	}
);
