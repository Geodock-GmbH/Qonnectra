/**
 * Fetch the fiber splices touching a cable on either side (`cable_a`/`cable_b`)
 * and merge them into a uuid-deduplicated list.
 * @param fetchFn - The fetch implementation to use.
 * @param headers - Django auth headers.
 * @param apiUrl - Backend base URL.
 * @param cableUuid - Cable UUID to inspect.
 * @returns The deduplicated splice records.
 */
export async function fetchCableSplices(
	fetchFn: typeof fetch,
	headers: Record<string, string>,
	apiUrl: string,
	cableUuid: string
): Promise<Record<string, unknown>[]> {
	const [splicesAResponse, splicesBResponse] = await Promise.all([
		fetchFn(`${apiUrl}fiber-splice/?cable_a=${cableUuid}`, { method: 'GET', headers }),
		fetchFn(`${apiUrl}fiber-splice/?cable_b=${cableUuid}`, { method: 'GET', headers })
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
