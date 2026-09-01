import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { fetchCableSplicesAtNode } from './cable-splices';
import { djangoHeaders } from './remote-auth';

const SplicesAtNodeSchema = v.object({
	cableUuid: v.pipe(v.string(), v.nonEmpty()),
	nodeUuid: v.pipe(v.string(), v.nonEmpty())
});

const UpdateConnectionSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	nodeStartId: v.optional(v.string()),
	nodeEndId: v.optional(v.string()),
	handleStart: v.optional(v.string()),
	handleEnd: v.optional(v.string())
});

/**
 * Fetch the fiber splices of a cable that sit at a given node (both sides).
 * Used to warn before re-connecting a cable end that would orphan splices.
 * @param input.cableUuid - Cable UUID.
 * @param input.nodeUuid - Node UUID to filter by.
 * @returns The deduplicated splice records at that node.
 * @throws When a backend request fails.
 */
export const getCableSplicesAtNode = query(SplicesAtNodeSchema, async ({ cableUuid, nodeUuid }) => {
	return fetchCableSplicesAtNode(fetch, djangoHeaders(), API_URL, cableUuid, nodeUuid);
});

/**
 * Re-point one end of a cable to a different node (and/or update its handle).
 * @param input.cableId - Cable UUID.
 * @param input.nodeStartId - New start node UUID (when changing the start).
 * @param input.nodeEndId - New end node UUID (when changing the end).
 * @param input.handleStart - New start handle position.
 * @param input.handleEnd - New end handle position.
 * @returns The updated cable record.
 * @throws When the backend rejects the update.
 */
export const updateCableConnection = command(UpdateConnectionSchema, async (input) => {
	const headers = djangoHeaders(true);

	const requestBody: Record<string, unknown> = {};
	if (input.nodeStartId) requestBody.uuid_node_start_id = input.nodeStartId;
	if (input.nodeEndId) requestBody.uuid_node_end_id = input.nodeEndId;
	if (input.handleStart) requestBody.handle_start = input.handleStart;
	if (input.handleEnd) requestBody.handle_end = input.handleEnd;

	const response = await fetch(`${API_URL}cable/${input.cableId}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || `HTTP ${response.status}: Failed to update cable connection`
		);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Delete all fiber splices of a cable at a given node (both sides).
 * @param input.cableUuid - Cable UUID.
 * @param input.nodeUuid - Node UUID whose splices are removed.
 * @returns Counts of deleted and failed splice deletions.
 * @throws When resolving the splices fails.
 */
export const deleteCableSplicesAtNode = command(
	SplicesAtNodeSchema,
	async ({ cableUuid, nodeUuid }) => {
		const headers = djangoHeaders();
		const splices = await fetchCableSplicesAtNode(fetch, headers, API_URL, cableUuid, nodeUuid);

		const deleteResults = await Promise.all(
			splices.map(async (splice) => {
				const deleteResponse = await fetch(`${API_URL}fiber-splice/${splice.uuid}/`, {
					method: 'DELETE',
					headers
				});
				return deleteResponse.ok;
			})
		);

		return {
			deletedCount: deleteResults.filter(Boolean).length,
			failedCount: deleteResults.filter((ok) => !ok).length
		};
	}
);
