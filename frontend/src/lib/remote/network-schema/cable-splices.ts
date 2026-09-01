/**
 * Fetch fiber splices for both cable sides (`cable_a`/`cable_b`), applying an
 * optional extra filter, and merge them into a uuid-deduplicated list.
 * @param fetchFn - The fetch implementation to use.
 * @param headers - Django auth headers.
 * @param apiUrl - Backend base URL.
 * @param cableUuid - Cable UUID to inspect.
 * @param extraFilter - Optional query fragment appended to each request (e.g. a node filter).
 * @returns The deduplicated splice records.
 */
async function fetchSplicesBothSides(
	fetchFn: typeof fetch,
	headers: Record<string, string>,
	apiUrl: string,
	cableUuid: string,
	extraFilter = ''
): Promise<Record<string, unknown>[]> {
	const [splicesAResponse, splicesBResponse] = await Promise.all([
		fetchFn(`${apiUrl}fiber-splice/?cable_a=${cableUuid}${extraFilter}`, {
			method: 'GET',
			headers
		}),
		fetchFn(`${apiUrl}fiber-splice/?cable_b=${cableUuid}${extraFilter}`, { method: 'GET', headers })
	]);

	const splicesA: Record<string, unknown>[] = splicesAResponse.ok
		? await splicesAResponse.json()
		: [];
	const splicesB: Record<string, unknown>[] = splicesBResponse.ok
		? await splicesBResponse.json()
		: [];

	const spliceMap = new Map<unknown, Record<string, unknown>>();
	for (const splice of [...splicesA, ...splicesB]) {
		if (splice.uuid) {
			spliceMap.set(splice.uuid, splice);
		}
	}
	return Array.from(spliceMap.values());
}

/**
 * Fetch the fiber splices touching a cable on either side, deduplicated.
 * @param fetchFn - The fetch implementation to use.
 * @param headers - Django auth headers.
 * @param apiUrl - Backend base URL.
 * @param cableUuid - Cable UUID to inspect.
 * @returns The deduplicated splice records.
 */
export function fetchCableSplices(
	fetchFn: typeof fetch,
	headers: Record<string, string>,
	apiUrl: string,
	cableUuid: string
): Promise<Record<string, unknown>[]> {
	return fetchSplicesBothSides(fetchFn, headers, apiUrl, cableUuid);
}

/**
 * Fetch the fiber splices of a cable that sit at a specific node, deduplicated.
 * @param fetchFn - The fetch implementation to use.
 * @param headers - Django auth headers.
 * @param apiUrl - Backend base URL.
 * @param cableUuid - Cable UUID to inspect.
 * @param nodeUuid - Node UUID to filter splices by.
 * @returns The deduplicated splice records at that node.
 */
export function fetchCableSplicesAtNode(
	fetchFn: typeof fetch,
	headers: Record<string, string>,
	apiUrl: string,
	cableUuid: string,
	nodeUuid: string
): Promise<Record<string, unknown>[]> {
	return fetchSplicesBothSides(
		fetchFn,
		headers,
		apiUrl,
		cableUuid,
		`&node_structure__uuid_node=${nodeUuid}`
	);
}
