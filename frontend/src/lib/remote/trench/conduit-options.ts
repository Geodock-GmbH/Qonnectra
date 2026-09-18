/** A conduit offered in the conduit picker of the trench route. */
export interface ConduitOption {
	/** Conduit UUID. */
	value: string;
	label: string;
}

/**
 * Maps the unpaginated `conduit/all/` list to picker options labelled
 * `name (type)`.
 * @param data - Body of `conduit/all/`, a plain list or a `results` envelope.
 * @returns One option per conduit that carries a UUID.
 */
export function mapConduitOptions(data: unknown): ConduitOption[] {
	const envelope = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
	const rows: unknown = Array.isArray(data) ? data : envelope.results;
	if (!Array.isArray(rows)) return [];

	return rows.flatMap((row: unknown): ConduitOption[] => {
		if (!row || typeof row !== 'object') return [];
		const { uuid, name, conduit_type: type } = row as Record<string, unknown>;
		if (typeof uuid !== 'string') return [];

		const title = name == null ? '' : String(name);
		return [{ value: uuid, label: type ? `${title} (${String(type)})` : title }];
	});
}
