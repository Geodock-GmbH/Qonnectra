import type { TrenchesNearNodeResult } from '$lib/types';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const NearNodeSchema = v.object({
	nodeName: v.pipe(v.string(), v.nonEmpty()),
	projectId: v.pipe(v.string(), v.nonEmpty())
});

const SaveSelectionsSchema = v.object({
	nodeUuid: UuidSchema,
	trenchUuids: v.array(UuidSchema)
});

/**
 * Fetch the trenches around a node with their conduits and microducts.
 * @param input.nodeName - Name of the pipe-branch node.
 * @param input.projectId - Project the node belongs to.
 * @returns The nearby trenches and the node the backend resolved the name to.
 * @throws When the node is unknown or the backend request fails.
 */
export const getTrenchesNearNode = query(
	NearNodeSchema,
	async ({ nodeName, projectId }): Promise<TrenchesNearNodeResult> => {
		const response = await fetch(
			`${API_URL}trenches-near-node/?node_name=${encodeURIComponent(nodeName)}&project=${encodeURIComponent(projectId)}`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to fetch trenches near node');

		return (await response.json()) as TrenchesNearNodeResult;
	}
);

/**
 * Fetch the trenches that were last loaded onto the canvas of a node.
 * @param nodeUuid - Pipe-branch node UUID.
 * @returns UUIDs of the saved trenches.
 * @throws When the backend request fails.
 */
export const getTrenchSelections = query(UuidSchema, async (nodeUuid): Promise<string[]> => {
	const response = await fetch(
		`${API_URL}node-trench-selection/by-node/${encodeURIComponent(nodeUuid)}/`,
		{ headers: djangoHeaders() }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to fetch trench selections');

	const selections: unknown = await response.json();
	return Array.isArray(selections)
		? selections.map((selection: { trench: string }) => selection.trench)
		: [];
});

/**
 * Replace the saved trench selection of a node and refresh it in the same flight.
 * @param input.nodeUuid - Pipe-branch node UUID.
 * @param input.trenchUuids - UUIDs of the trenches to remember.
 * @throws When the backend rejects the selection.
 */
export const saveTrenchSelections = command(
	SaveSelectionsSchema,
	async ({ nodeUuid, trenchUuids }): Promise<void> => {
		const response = await fetch(`${API_URL}node-trench-selection/bulk-update/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({ node_uuid: nodeUuid, trench_uuids: trenchUuids })
		});
		if (!response.ok) await failFromResponse(response, 'Failed to save trench selections');

		await getTrenchSelections(nodeUuid).refresh();
	}
);
