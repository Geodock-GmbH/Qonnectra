import type { TrenchesNearNodeTrench } from '$lib/types';

import { getConnections } from '$lib/remote/pipe-branch/connections.remote';
import {
	getTrenchesNearNode,
	getTrenchSelections
} from '$lib/remote/pipe-branch/trench-selections.remote';

import { lockedConduitKeys, preselectedKeys, selectedTrenches } from './branchGraph';

/** The pipe-branch node a canvas shows, as named in the URL and resolved from the branch list. */
export interface PipeBranchNodeRef {
	uuid: string;
	name: string;
}

/**
 * Loads what the canvas of a node showed last: its saved trenches with all
 * their conduits, plus every conduit that already carries a connection.
 * Empty when nothing was saved yet, so the caller opens the selector.
 * @param projectId - Project the node belongs to.
 * @param node - The node named in the URL.
 * @returns The trenches to put on the canvas.
 * @throws When the node is unknown or a backend request fails.
 */
export async function loadSavedCanvas(
	projectId: string,
	node: PipeBranchNodeRef
): Promise<TrenchesNearNodeTrench[]> {
	const nearby = await getTrenchesNearNode({ nodeName: node.name, projectId });
	const [saved, connections] = await Promise.all([
		getTrenchSelections(node.uuid),
		getConnections(node.uuid)
	]);
	const keys = preselectedKeys(
		nearby.trenches,
		saved,
		lockedConduitKeys(connections, nearby.trenches)
	);
	return selectedTrenches(nearby.trenches, keys);
}
