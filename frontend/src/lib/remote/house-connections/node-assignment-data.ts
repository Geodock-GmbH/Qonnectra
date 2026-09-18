import type { Microduct } from '$lib/remote/conduit/microduct-data';
import { API_URL } from '$env/static/private';

import { failFromResponse } from '$lib/remote/shared/backend-error';

/**
 * Points a microduct at a node, or clears the link when `nodeUuid` is `null`.
 * @param headers - Django auth headers including the JSON content type.
 * @param microductUuid - UUID of the microduct.
 * @param nodeUuid - UUID of the node to link, or `null` to unassign.
 * @param fallback - Error message when the backend gives no reason.
 * @returns The updated microduct.
 * @throws When the backend rejects the update.
 */
export async function setMicroductNode(
	headers: Record<string, string>,
	microductUuid: string,
	nodeUuid: string | null,
	fallback: string
): Promise<Microduct> {
	const response = await fetch(`${API_URL}microduct/${encodeURIComponent(microductUuid)}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify({ uuid_node_id: nodeUuid })
	});
	if (!response.ok) await failFromResponse(response, fallback);

	return (await response.json()) as Microduct;
}
