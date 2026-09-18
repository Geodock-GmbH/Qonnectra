/** The nested foreign-key objects a conduit detail response carries. */
export interface ConduitTypeRef {
	id: number;
	conduit_type: string;
}
export interface StatusRef {
	id: number;
	status: string;
}
export interface NetworkLevelRef {
	id: number;
	network_level: string;
}
export interface CompanyRef {
	id: number;
	company: string;
}
export interface FlagRef {
	id: number;
	flag: string;
}

/** A conduit as returned by `conduit/<uuid>/`, with expanded references. */
export interface ConduitRecord {
	uuid: string;
	name: string;
	outer_conduit?: string | null;
	date?: string | null;
	conduit_type?: ConduitTypeRef | null;
	status?: StatusRef | null;
	network_level?: NetworkLevelRef | null;
	owner?: CompanyRef | null;
	constructor?: CompanyRef | null;
	manufacturer?: CompanyRef | null;
	flag?: FlagRef | null;
	project?: { id?: number; project?: string } | null;
}

/** One row of the paginated conduit list, flattened for table display. */
export interface ConduitListRow {
	value: string;
	name: string;
	conduit_type: string;
	outer_conduit: string;
	status: string;
	network_level: string;
	owner: string;
	constructor: string;
	manufacturer: string;
	date: string;
	flag: string;
}

/** A page of conduit rows plus the backend's pagination envelope. */
export interface ConduitListPage {
	conduits: ConduitListRow[];
	pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

/** The editable conduit fields as sent by the create and update forms. */
export interface ConduitFields {
	name: string;
	outer_conduit?: string;
	date?: string;
	conduit_type_id?: number;
	status_id?: number;
	network_level_id?: number;
	owner_id?: number;
	constructor_id?: number;
	manufacturer_id?: number;
	flag_id?: number;
}

/** What the backend reports for an Excel import. */
export interface ConduitImportResult {
	createdCount: number;
	message: string;
	warnings: string[];
}

export const EMPTY_PAGINATION = { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 };

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Maps one lightweight list serializer item to a table row, defaulting
 * missing text fields to empty strings.
 * @param item - A result row of `conduit/all/`.
 * @returns The flattened table row.
 */
export function mapConduitListRow(item: Record<string, unknown>): ConduitListRow {
	const text = (key: string) => (typeof item[key] === 'string' ? (item[key] as string) : '');
	return {
		value: String(item.uuid ?? ''),
		name: text('name'),
		conduit_type: text('conduit_type'),
		outer_conduit: text('outer_conduit'),
		status: text('status'),
		network_level: text('network_level'),
		owner: text('owner'),
		constructor: text('constructor'),
		manufacturer: text('manufacturer'),
		date: text('date'),
		flag: text('flag')
	};
}

/**
 * Maps the paginated `conduit/all/` payload to rows plus pagination.
 * @param payload - The backend page envelope.
 * @returns The table rows and pagination metadata.
 */
export function mapConduitListPage(payload: Record<string, unknown>): ConduitListPage {
	const results = Array.isArray(payload.results)
		? (payload.results as Record<string, unknown>[])
		: [];
	return {
		conduits: results.map(mapConduitListRow),
		pagination: {
			page: (payload.page as number) || EMPTY_PAGINATION.page,
			pageSize: (payload.page_size as number) || EMPTY_PAGINATION.pageSize,
			totalCount: (payload.count as number) || EMPTY_PAGINATION.totalCount,
			totalPages: (payload.total_pages as number) || EMPTY_PAGINATION.totalPages
		}
	};
}

/**
 * Builds the POST body for a new conduit. Only non-empty optional fields are
 * sent so the backend applies its own defaults.
 * @param projectId - Project the conduit belongs to (omitted when empty).
 * @param fields - The form values.
 * @returns The POST body for `conduit/`.
 */
export function buildConduitCreateBody(
	projectId: number | undefined,
	fields: ConduitFields
): Record<string, unknown> {
	const body: Record<string, unknown> = { name: fields.name };
	if (projectId) body.project_id = projectId;
	if (fields.outer_conduit) body.outer_conduit = fields.outer_conduit;
	Object.assign(body, referenceIds(fields));
	if (fields.date) body.date = fields.date;
	return body;
}

/**
 * Builds the PATCH body for an existing conduit. `outer_conduit` is always
 * sent so clearing the textarea clears the field; unset references are
 * left untouched.
 * @param fields - The form values.
 * @returns The PATCH body for `conduit/<uuid>/`.
 */
export function buildConduitPatch(fields: ConduitFields): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (fields.name) body.name = fields.name;
	body.outer_conduit = fields.outer_conduit ?? '';
	Object.assign(body, referenceIds(fields));
	if (fields.date) body.date = fields.date;
	return body;
}

/**
 * Picks the set foreign-key ids out of the form values.
 * @param fields - The form values.
 * @returns The non-empty `*_id` fields, keyed by field name.
 */
function referenceIds(fields: ConduitFields): Record<string, number> {
	const ids: Record<string, number> = {};
	const keys = [
		'conduit_type_id',
		'status_id',
		'network_level_id',
		'owner_id',
		'constructor_id',
		'manufacturer_id',
		'flag_id'
	] as const;
	for (const key of keys) {
		const value = fields[key];
		if (value) ids[key] = value;
	}
	return ids;
}

/**
 * Reads the duplicate-name signal out of a rejected create response so the
 * caller can show a specific message.
 * @param status - HTTP status of the response.
 * @param errorData - Parsed JSON error body.
 * @returns `true` when the rejection is a duplicate-name clash.
 */
export function isDuplicateConduitError(status: number, errorData: unknown): boolean {
	if (status !== 400 || !errorData || typeof errorData !== 'object') return false;
	const data = errorData as Record<string, unknown>;
	return (
		(Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) ||
		(Array.isArray(data.name) && data.name.length > 0)
	);
}

/**
 * Validates an uploaded import file before it is forwarded to the backend.
 * @param file - The submitted file.
 * @returns A user-facing problem description, or `null` when the file is acceptable.
 */
export function importFileIssue(file: File): string | null {
	if (!file.name || file.size === 0) return 'No file uploaded or invalid file';
	if (!file.name.endsWith('.xlsx') && file.type !== XLSX_MIME) {
		return 'Invalid file format. Please upload an .xlsx file.';
	}
	if (file.size > MAX_IMPORT_FILE_SIZE) {
		return `File too large. Maximum size is ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB.`;
	}
	return null;
}

/**
 * Builds one message from a failed import response: row errors first, then
 * warnings, falling back to the backend's summary.
 * @param result - Parsed JSON body of the failed `import/conduit/` response.
 * @returns A newline-joined, user-facing error message.
 */
export function importErrorMessage(result: unknown): string {
	const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
	const lines = [
		...(Array.isArray(data.errors) ? data.errors.map(String) : []),
		...(Array.isArray(data.warnings) ? data.warnings.map(String) : [])
	];
	if (lines.length > 0) return lines.join('\n');
	return typeof data.error === 'string' && data.error ? data.error : 'Import failed';
}

/**
 * Maps a successful `import/conduit/` response to the client-facing result.
 * @param result - Parsed JSON body.
 * @returns The created count, summary message and warnings.
 */
export function mapImportResult(result: Record<string, unknown>): ConduitImportResult {
	return {
		createdCount: (result.created_count as number) || 0,
		message: (result.message as string) || '',
		warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : []
	};
}
