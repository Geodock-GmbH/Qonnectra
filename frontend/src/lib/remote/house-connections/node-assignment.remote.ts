import type { Microduct } from '$lib/remote/conduit/microduct-data';
import { command } from '$app/server';
import * as v from 'valibot';

import { getMicroducts } from '$lib/remote/conduit/microducts.remote';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { setMicroductNode } from './node-assignment-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const AssignNodeSchema = v.object({
	microductUuid: UuidSchema,
	conduitUuid: UuidSchema,
	nodeUuid: UuidSchema
});

const RemoveNodeSchema = v.object({
	microductUuid: UuidSchema,
	conduitUuid: UuidSchema
});

/**
 * Connect a microduct to a node and refresh its conduit's microduct list in
 * the same flight.
 * @param input.microductUuid - Microduct UUID.
 * @param input.conduitUuid - Owning conduit, whose `getMicroducts` instance is refreshed.
 * @param input.nodeUuid - Node the microduct ends at.
 * @returns The updated microduct.
 * @throws When the backend rejects the assignment.
 */
export const assignNodeToMicroduct = command(
	AssignNodeSchema,
	async ({ microductUuid, conduitUuid, nodeUuid }): Promise<Microduct> => {
		const headers = djangoHeaders(true);
		const updated = await setMicroductNode(
			headers,
			microductUuid,
			nodeUuid,
			'Failed to assign node'
		);
		await getMicroducts(conduitUuid).refresh();
		return updated;
	}
);

/**
 * Clear a microduct's node and refresh its conduit's microduct list in the
 * same flight.
 * @param input.microductUuid - Microduct UUID.
 * @param input.conduitUuid - Owning conduit, whose `getMicroducts` instance is refreshed.
 * @returns The updated microduct.
 * @throws When the backend rejects the removal.
 */
export const removeNodeFromMicroduct = command(
	RemoveNodeSchema,
	async ({ microductUuid, conduitUuid }): Promise<Microduct> => {
		const headers = djangoHeaders(true);
		const updated = await setMicroductNode(headers, microductUuid, null, 'Failed to remove node');
		await getMicroducts(conduitUuid).refresh();
		return updated;
	}
);
