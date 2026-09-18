/** A pipe-branch node as offered by the branch combobox. */
export interface PipeBranchOption {
	label: string;
	value: string;
	uuid: string;
}

/** The pipe-branch nodes of a project and whether the project configured which nodes count. */
export interface PipeBranchList {
	branches: PipeBranchOption[];
	configured: boolean;
}

/**
 * Reads the minimal `node/all/` payload into combobox options. Nodes without
 * a name or uuid are skipped; an unexpected payload yields no branches.
 * @param data - Parsed backend payload (may be anything).
 * @returns The branch options and the project's configuration flag.
 */
export function toPipeBranchList(data: unknown): PipeBranchList {
	if (!data || typeof data !== 'object') return { branches: [], configured: false };

	const { nodes, metadata } = data as {
		nodes?: unknown;
		metadata?: { pipe_branch_configured?: unknown } | null;
	};
	if (!Array.isArray(nodes)) return { branches: [], configured: false };

	const branches = nodes.flatMap((node: { name?: unknown; uuid?: unknown } | null) =>
		typeof node?.name === 'string' && typeof node.uuid === 'string'
			? [{ label: node.name, value: node.name, uuid: node.uuid }]
			: []
	);

	return { branches, configured: metadata?.pipe_branch_configured === true };
}
