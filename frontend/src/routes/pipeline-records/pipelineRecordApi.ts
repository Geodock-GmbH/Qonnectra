/**
 * Shared helpers for the pipeline-record create/edit server routes.
 */

interface LookupItem {
	id: number;
	name: string;
}

export interface ComboboxOption {
	value: number;
	label: string;
}

interface ProjectRow {
	id: number;
	project: string;
}

interface PaginatedProjects {
	results: ProjectRow[];
}

interface FormDataLike {
	get: (key: string) => FormDataEntryValue | null;
}

interface PipelineRecordBody {
	project?: number;
	type_of_work_value: number | null;
	request_reason_value: number | null;
	organisation: string | null;
	name: string | null;
	tel: string | null;
	mobile: string | null;
}

interface ErrorPayload {
	detail?: string;
	[key: string]: unknown;
}

/**
 * Maps a lookup list ([{id, name}]) to combobox option objects.
 */
export function mapLookupOptions(items: LookupItem[]): ComboboxOption[] {
	return (items || []).map((item) => ({ value: item.id, label: item.name }));
}

/**
 * Maps the projects endpoint (array or paginated envelope) to combobox options.
 */
export function mapProjectOptions(data: ProjectRow[] | PaginatedProjects): ComboboxOption[] {
	const rows: ProjectRow[] = Array.isArray(data) ? data : data?.results || [];
	return rows.map((p) => ({ value: p.id, label: p.project }));
}

/**
 * Builds the write request body from submitted form data using the backend's
 * write field names. The project FK is required; the other FKs and text fields
 * coerce empty strings to null.
 */
export function buildRequestBody(formData: FormDataLike): PipelineRecordBody {
	const project = formData.get('project');
	const typeOfWorkValue = formData.get('type_of_work_value');
	const requestReasonValue = formData.get('request_reason_value');
	const organisation = formData.get('organisation');
	const name = formData.get('name');
	const tel = formData.get('tel');
	const mobile = formData.get('mobile');

	const requestBody: PipelineRecordBody = {
		type_of_work_value: null,
		request_reason_value: null,
		organisation: null,
		name: null,
		tel: null,
		mobile: null
	};

	if (project) requestBody.project = parseInt(String(project), 10);
	requestBody.type_of_work_value = typeOfWorkValue ? parseInt(String(typeOfWorkValue), 10) : null;
	requestBody.request_reason_value = requestReasonValue
		? parseInt(String(requestReasonValue), 10)
		: null;
	requestBody.organisation = organisation ? String(organisation) : null;
	requestBody.name = name ? String(name) : null;
	requestBody.tel = tel ? String(tel) : null;
	requestBody.mobile = mobile ? String(mobile) : null;

	return requestBody;
}

/**
 * Flattens a DRF error payload into a single human-readable message.
 */
export function flattenError(errorData: ErrorPayload | null | undefined, fallback: string): string {
	return (
		errorData?.detail ||
		Object.entries(errorData || {})
			.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
			.join('; ') ||
		fallback
	);
}
