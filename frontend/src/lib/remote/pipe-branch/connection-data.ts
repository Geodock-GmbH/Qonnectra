import { API_URL } from '$env/static/private';

import { backendErrorMessage } from '$lib/remote/shared/backend-error';

/** One end of a microduct connection: the microduct and the trench it arrives in. */
export interface MicroductEnd {
	microductUuid: string;
	trenchUuid: string;
}

/** Two microducts to be joined at a pipe-branch node. */
export interface MicroductPair {
	from: MicroductEnd;
	to: MicroductEnd;
}

/** A microduct connection at a pipe-branch node; `uuid` is `null` until the backend stored it. */
export interface BranchConnection extends MicroductPair {
	uuid: string | null;
}

/** Outcome of a connection batch; an error is `null` when the backend gave no reason. */
export interface ConnectionBatchResult {
	created: number;
	errors: Array<string | null>;
}

interface ConnectionRow {
	uuid?: unknown;
	uuid_microduct_from?: { uuid?: unknown } | null;
	uuid_microduct_to?: { uuid?: unknown } | null;
	uuid_trench_from?: { id?: unknown } | null;
	uuid_trench_to?: { id?: unknown } | null;
}

/**
 * Reduces the backend's connection rows, which nest full microducts and
 * trench features, to the uuids of both ends. Rows missing an end are dropped.
 * @param data - Parsed `all_connections` payload (may be anything).
 * @returns The connections of the node.
 */
export function toBranchConnections(data: unknown): BranchConnection[] {
	if (!Array.isArray(data)) return [];

	return data.flatMap((row: ConnectionRow | null) => {
		const uuid = row?.uuid;
		const fromMicroduct = row?.uuid_microduct_from?.uuid;
		const fromTrench = row?.uuid_trench_from?.id;
		const toMicroduct = row?.uuid_microduct_to?.uuid;
		const toTrench = row?.uuid_trench_to?.id;
		if (
			typeof uuid !== 'string' ||
			typeof fromMicroduct !== 'string' ||
			typeof fromTrench !== 'string' ||
			typeof toMicroduct !== 'string' ||
			typeof toTrench !== 'string'
		) {
			return [];
		}

		return [
			{
				uuid,
				from: { microductUuid: fromMicroduct, trenchUuid: fromTrench },
				to: { microductUuid: toMicroduct, trenchUuid: toTrench }
			}
		];
	});
}

type ConnectionOutcome = { created: true } | { created: false; reason: string | null };

/**
 * Creates one connection.
 * @param headers - Django auth headers including the JSON content type.
 * @param nodeUuid - Pipe-branch node the microducts are joined at.
 * @param pair - The microducts to connect.
 * @returns Whether the backend created it, with its reason when it did not.
 */
async function postConnection(
	headers: Record<string, string>,
	nodeUuid: string,
	{ from, to }: MicroductPair
): Promise<ConnectionOutcome> {
	const response = await fetch(`${API_URL}microduct_connection/`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			uuid_microduct_from_id: from.microductUuid,
			uuid_microduct_to_id: to.microductUuid,
			uuid_node_id: nodeUuid,
			uuid_trench_from_id: from.trenchUuid,
			uuid_trench_to_id: to.trenchUuid
		})
	});
	if (response.ok) return { created: true };

	const errorData = await response.json().catch(() => ({}));
	return { created: false, reason: backendErrorMessage(errorData, '') || null };
}

/**
 * Creates the given connections one after another. A rejected or unreachable
 * pair does not stop the batch; its reason is collected instead.
 * @param headers - Django auth headers including the JSON content type.
 * @param nodeUuid - Pipe-branch node the microducts are joined at.
 * @param pairs - The microduct pairs to connect.
 * @returns How many connections were created and why the others were not.
 */
export async function createConnectionBatch(
	headers: Record<string, string>,
	nodeUuid: string,
	pairs: MicroductPair[]
): Promise<ConnectionBatchResult> {
	const result: ConnectionBatchResult = { created: 0, errors: [] };

	for (const pair of pairs) {
		const outcome = await postConnection(headers, nodeUuid, pair).catch(
			(): ConnectionOutcome => ({ created: false, reason: null })
		);
		if (outcome.created) result.created++;
		else result.errors.push(outcome.reason);
	}

	return result;
}
