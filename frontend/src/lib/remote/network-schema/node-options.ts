/** A raw node record as returned by the API (GeoJSON feature or flat node). */
interface RawNodeItem {
	id?: string;
	uuid?: string;
	name?: string;
	properties?: { uuid?: string; name?: string };
}

/**
 * Maps node API responses (GeoJSON, minimal, or flat array) to combobox option format.
 */
export function mapNodesToOptions(nodesData: unknown): { value: string; label: string }[] {
	const bag = nodesData as { features?: RawNodeItem[]; nodes?: RawNodeItem[] } | RawNodeItem[];
	const items: RawNodeItem[] = Array.isArray(bag) ? bag : (bag?.features ?? bag?.nodes ?? []);
	return items.map((item) => {
		const node = item.properties ?? item;
		return {
			value: item.id ?? node.uuid ?? '',
			label: node.name ?? 'Unnamed Node'
		};
	});
}
