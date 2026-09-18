/** A lightweight address hit of the backend's `trace-search/` picker. */
export interface AddressSearchResult {
	uuid: string;
	id_address: string;
	street: string;
	housenumber: number | null;
	house_number_suffix: string;
	zip_code: string;
	city: string;
}

/**
 * Maps the `trace-search/?type=address` payload to search results, dropping
 * hits without a uuid since they cannot be selected.
 * @param payload - The raw response body.
 * @returns The selectable address hits, or an empty array when none.
 */
export function mapAddressSearchResults(payload: unknown): AddressSearchResult[] {
	const results = (payload as { results?: unknown } | null)?.results;
	if (!Array.isArray(results)) return [];

	return (results as Record<string, unknown>[])
		.filter((item) => item.uuid)
		.map((item) => ({
			uuid: String(item.uuid),
			id_address: (item.id_address as string) || '',
			street: (item.street as string) || '',
			housenumber: (item.housenumber as number | null) ?? null,
			house_number_suffix: (item.house_number_suffix as string) || '',
			zip_code: (item.zip_code as string) || '',
			city: (item.city as string) || ''
		}));
}

/**
 * Formats a search result as `Street, 12a, 12345 City`, falling back to the
 * short uuid when the address carries no text at all.
 * @param result - The search result to label.
 * @returns The human-readable label.
 */
export function formatAddressSearchResult(result: AddressSearchResult): string {
	const parts: string[] = [];
	if (result.street) parts.push(result.street);
	if (result.housenumber != null) parts.push(`${result.housenumber}${result.house_number_suffix}`);
	const locality = `${result.zip_code} ${result.city}`.trim();
	if (locality) parts.push(locality);
	return parts.join(', ') || result.uuid.slice(0, 8);
}
