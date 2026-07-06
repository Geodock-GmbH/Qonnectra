/**
 * Shared helpers for the pipeline-record create/edit server routes.
 */

/**
 * Maps a lookup list ([{id, name}]) to combobox option objects.
 * @param {Array<{id: number, name: string}>} items - Lookup rows from the API.
 * @returns {Array<{value: number, label: string}>} Combobox options.
 */
export function mapLookupOptions(items) {
	return (items || []).map((item) => ({ value: item.id, label: item.name }));
}

/**
 * Maps the projects endpoint (array or paginated envelope) to combobox options.
 * @param {any} data - Raw projects response ([{id, project}] or {results: [...]}).
 * @returns {Array<{value: number, label: string}>} Combobox options.
 */
export function mapProjectOptions(data) {
	const rows = Array.isArray(data) ? data : data?.results || [];
	return rows.map((/** @type {any} */ p) => ({ value: p.id, label: p.project }));
}

/**
 * Builds the write request body from submitted form data using the backend's
 * write field names. The project FK is required; the other FKs and text fields
 * coerce empty strings to null.
 * @param {{ get: (key: string) => any }} formData - Submitted form data.
 * @returns {Record<string, any>} JSON body for POST/PATCH.
 */
export function buildRequestBody(formData) {
	const project = formData.get('project');
	const typeOfWorkValue = formData.get('type_of_work_value');
	const requestReasonValue = formData.get('request_reason_value');
	const organisation = formData.get('organisation');
	const name = formData.get('name');
	const tel = formData.get('tel');
	const mobile = formData.get('mobile');

	/** @type {Record<string, any>} */
	const requestBody = {};

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
 * @param {any} errorData - Parsed error response body.
 * @param {string} fallback - Message to use when nothing else is present.
 * @returns {string} A flattened error message.
 */
export function flattenError(errorData, fallback) {
	return (
		errorData?.detail ||
		Object.entries(errorData || {})
			.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
			.join('; ') ||
		fallback
	);
}
