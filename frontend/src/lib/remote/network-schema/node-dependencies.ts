export interface NodeDependencies {
	cables: Record<string, unknown>[];
	structures: Record<string, unknown>[];
	children: Record<string, unknown>[];
	childrenWithCables: { nodeId: string; nodeName: string; cableCount: number }[];
	hasChildren: boolean;
	hasCables: boolean;
	hasChildrenWithCables: boolean;
}

/**
 * Fetch a node's deletion dependencies: connected cables, node structures, and
 * child nodes (flagging any child that itself has cables). Used to gate node
 * deletion and lock the type/parent fields when changing them would break the
 * hierarchy.
 * @param fetchFn - The fetch implementation to use.
 * @param headers - Django auth headers.
 * @param apiUrl - Backend base URL.
 * @param nodeId - Node UUID to inspect.
 * @param projectId - Project id; when absent, children are not resolved.
 * @returns The dependency summary.
 */
export async function fetchNodeDependencies(
	fetchFn: typeof fetch,
	headers: Record<string, string>,
	apiUrl: string,
	nodeId: string,
	projectId: string | undefined
): Promise<NodeDependencies> {
	const cablesResponse = await fetchFn(`${apiUrl}cable/at-node/${nodeId}/`, {
		method: 'GET',
		headers
	});
	const cables: Record<string, unknown>[] = cablesResponse.ok ? await cablesResponse.json() : [];

	const structuresResponse = await fetchFn(`${apiUrl}node-structure/?node=${nodeId}`, {
		method: 'GET',
		headers
	});
	const structures: Record<string, unknown>[] = structuresResponse.ok
		? await structuresResponse.json()
		: [];

	let children: Record<string, unknown>[] = [];
	const childrenWithCables: { nodeId: string; nodeName: string; cableCount: number }[] = [];

	if (projectId) {
		const childrenResponse = await fetchFn(
			`${apiUrl}node/?parent_node=${nodeId}&project=${projectId}`,
			{ method: 'GET', headers }
		);

		if (childrenResponse.ok) {
			const childrenData = await childrenResponse.json();
			children =
				childrenData.results?.features ||
				childrenData.features ||
				(Array.isArray(childrenData) ? childrenData : []);

			for (const child of children) {
				const childProps = child.properties as Record<string, unknown> | undefined;
				const childId = String(child.id || childProps?.uuid || child.uuid || '');
				const childName = String(childProps?.name || child.name || '');
				const childCablesResponse = await fetchFn(`${apiUrl}cable/at-node/${childId}/`, {
					method: 'GET',
					headers
				});
				if (childCablesResponse.ok) {
					const childCables = await childCablesResponse.json();
					if (childCables.length > 0) {
						childrenWithCables.push({
							nodeId: childId,
							nodeName: childName,
							cableCount: childCables.length
						});
					}
				}
			}
		}
	}

	return {
		cables,
		structures,
		children,
		childrenWithCables,
		hasChildren: children.length > 0,
		hasCables: cables.length > 0,
		hasChildrenWithCables: childrenWithCables.length > 0
	};
}
