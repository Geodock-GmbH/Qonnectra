import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {number} Maximum upload file size in bytes (10MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Loads conduit list data with pagination, search, and attribute options for select inputs.
 * Returns empty defaults when no projectId is provided.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch, url, depends, cookies, params }) {
	depends('app:conduits');
	const headers = getAuthHeaders(cookies);
	const projectId = params.projectId;
	const searchTerm = url.searchParams.get('search') || '';
	const page = url.searchParams.get('page') || '1';
	const pageSize = url.searchParams.get('page_size') || '50';

	if (!projectId) {
		return {
			pipes: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
			pipesError: null,
			searchTerm,
			projectId,
			conduitTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: []
		};
	}

	try {
		const apiUrl = new URL(`${API_URL}conduit/all/`);
		apiUrl.searchParams.set('project', projectId);
		if (searchTerm) apiUrl.searchParams.set('search', searchTerm);
		apiUrl.searchParams.set('page', page);
		apiUrl.searchParams.set('page_size', pageSize);

		const [pipesResponse, ...selectResponses] = await Promise.all([
			fetch(apiUrl.toString(), { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_conduit_type/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_status/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_network_level/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_company/`, { credentials: 'include', headers }),
			fetch(`${API_URL}flags/`, { credentials: 'include', headers })
		]);

		if (!pipesResponse.ok) {
			console.error(`Failed to fetch conduits: ${pipesResponse.status}`);
			return {
				pipes: [],
				pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
				pipesError: 'Failed to fetch conduits',
				searchTerm,
				projectId,
				conduitTypes: [],
				statuses: [],
				networkLevels: [],
				companies: [],
				flags: []
			};
		}

		const pipesData = await pipesResponse.json();

		const pipes = (pipesData.results || []).map((/** @type {any} */ item) => ({
			value: item.uuid,
			name: item.name || '',
			conduit_type: item.conduit_type || '',
			outer_conduit: item.outer_conduit || '',
			status: item.status || '',
			network_level: item.network_level || '',
			owner: item.owner || '',
			constructor: item.constructor || '',
			manufacturer: item.manufacturer || '',
			date: item.date || '',
			flag: item.flag || ''
		}));

		const [conduitTypesData, statusesData, networkLevelsData, companiesData, flagsData] =
			await Promise.all(selectResponses.map((res) => (res.ok ? res.json() : [])));

		const conduitTypes = conduitTypesData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.conduit_type
		}));

		const statuses = statusesData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.status
		}));

		const networkLevels = networkLevelsData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.network_level
		}));

		const companies = companiesData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.company
		}));

		const flags = flagsData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.flag
		}));

		return {
			pipes,
			pagination: {
				page: pipesData.page || 1,
				pageSize: pipesData.page_size || 50,
				totalCount: pipesData.count || 0,
				totalPages: pipesData.total_pages || 0
			},
			pipesError: null,
			searchTerm,
			projectId,
			conduitTypes,
			statuses,
			networkLevels,
			companies,
			flags
		};
	} catch (err) {
		console.error('Error fetching data:', err);
		return {
			pipes: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
			pipesError: 'Error occurred while fetching data',
			searchTerm,
			projectId,
			conduitTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: []
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * Fetches a single conduit by UUID from the backend API.
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing `uuid`.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	getConduit: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const uuid = formData.get('uuid');

			if (!uuid) {
				return fail(400, { error: 'Missing required parameter: uuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}conduit/${uuid}/`, {
				method: 'GET',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorText = await response.text();
				return fail(response.status, { error: errorText });
			}

			const conduit = await response.json();
			return { conduit };
		} catch (error) {
			console.error('Conduit GET action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},

	/**
	 * Updates an existing conduit via PATCH. Only non-empty fields are sent.
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing conduit fields.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	updateConduit: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const conduitId = formData.get('uuid');
		const name = formData.get('conduit_name');
		const conduit_type_id = formData.get('conduit_type_id');
		const outer_conduit = formData.get('outer_conduit');
		const status_id = formData.get('status_id');
		const network_level_id = formData.get('network_level_id');
		const owner_id = formData.get('owner_id');
		const constructor_id = formData.get('constructor_id');
		const manufacturer_id = formData.get('manufacturer_id');
		const flag_id = formData.get('flag_id');
		const date = formData.get('date');

		if (!conduitId) {
			return fail(400, { message: 'Conduit ID is required' });
		}

		try {
			/** @type {Record<string, any>} */
			const requestBody = {};
			if (name) requestBody.name = name;
			if (conduit_type_id) requestBody.conduit_type_id = parseInt(String(conduit_type_id));
			if (outer_conduit !== null) requestBody.outer_conduit = outer_conduit;
			if (status_id) requestBody.status_id = parseInt(String(status_id));
			if (network_level_id) requestBody.network_level_id = parseInt(String(network_level_id));
			if (owner_id) requestBody.owner_id = parseInt(String(owner_id));
			if (constructor_id) requestBody.constructor_id = parseInt(String(constructor_id));
			if (manufacturer_id) requestBody.manufacturer_id = parseInt(String(manufacturer_id));
			if (flag_id) requestBody.flag_id = parseInt(String(flag_id));
			if (date) requestBody.date = date;

			const response = await fetch(`${API_URL}conduit/${conduitId}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, { message: errorData.detail || 'Failed to update conduit' });
			}

			const updatedConduit = await response.json();
			return {
				success: true,
				message: 'Conduit updated successfully',
				conduit: updatedConduit
			};
		} catch (err) {
			console.error('Error updating conduit:', err);
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to update conduit'
			});
		}
	},

	/**
	 * Deletes a conduit by UUID.
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing `uuid`.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	deleteConduit: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const conduitId = formData.get('uuid');

		if (!conduitId) {
			return fail(400, { message: 'Conduit ID is required' });
		}

		try {
			const response = await fetch(`${API_URL}conduit/${conduitId}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, { message: errorData.detail || 'Failed to delete conduit' });
			}

			return {
				success: true,
				message: 'Conduit deleted successfully'
			};
		} catch (err) {
			console.error('Error deleting conduit:', err);
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to delete conduit'
			});
		}
	},

	/**
	 * Creates a new conduit. Name is required; all other fields are optional.
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing conduit fields.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	createConduit: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const name = formData.get('name');
		const project_id = formData.get('project_id');
		const conduit_type_id = formData.get('conduit_type_id');
		const outer_conduit = formData.get('outer_conduit');
		const status_id = formData.get('status_id');
		const network_level_id = formData.get('network_level_id');
		const owner_id = formData.get('owner_id');
		const constructor_id = formData.get('constructor_id');
		const manufacturer_id = formData.get('manufacturer_id');
		const flag_id = formData.get('flag_id');
		const date = formData.get('date');

		if (!name) {
			return fail(400, { message: 'Conduit name is required' });
		}

		try {
			/** @type {Record<string, any>} */
			const requestBody = { name };
			if (project_id) requestBody.project_id = parseInt(String(project_id));
			if (conduit_type_id) requestBody.conduit_type_id = parseInt(String(conduit_type_id));
			if (outer_conduit) requestBody.outer_conduit = outer_conduit;
			if (status_id) requestBody.status_id = parseInt(String(status_id));
			if (network_level_id) requestBody.network_level_id = parseInt(String(network_level_id));
			if (owner_id) requestBody.owner_id = parseInt(String(owner_id));
			if (constructor_id) requestBody.constructor_id = parseInt(String(constructor_id));
			if (manufacturer_id) requestBody.manufacturer_id = parseInt(String(manufacturer_id));
			if (flag_id) requestBody.flag_id = parseInt(String(flag_id));
			if (date) requestBody.date = date;

			const response = await fetch(`${API_URL}conduit/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const isDuplicate =
					response.status === 400 &&
					(!!errorData.non_field_errors?.length || !!errorData.name?.length);
				return fail(response.status, { isDuplicate });
			}

			const newConduit = await response.json();
			return {
				success: true,
				message: 'Conduit created successfully',
				conduit: newConduit
			};
		} catch (err) {
			console.error('Error creating conduit:', err);
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to create conduit'
			});
		}
	},

	/**
	 * Imports conduits from an uploaded Excel (.xlsx) file. Validates format and size before forwarding to the backend.
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing the `file` field.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	uploadConduits: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);

		try {
			const formData = await request.formData();
			const file = formData.get('file');

			if (!file || !(file instanceof File)) {
				return fail(400, {
					uploadError: true,
					message: 'No file uploaded or invalid file'
				});
			}

			if (
				!file.name.endsWith('.xlsx') &&
				file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			) {
				return fail(400, {
					uploadError: true,
					message: 'Invalid file format. Please upload an .xlsx file.'
				});
			}

			if (file.size > MAX_FILE_SIZE) {
				return fail(400, {
					uploadError: true,
					message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
				});
			}

			const backendFormData = new FormData();
			backendFormData.append('file', file);

			const response = await fetch(`${API_URL}import/conduit/`, {
				method: 'POST',
				body: backendFormData,
				headers: headers
			});

			const result = await response.json();

			if (!response.ok) {
				return fail(response.status, {
					uploadError: true,
					message: result.error || 'Import failed',
					errors: result.errors || [],
					warnings: result.warnings || []
				});
			}

			return {
				uploadSuccess: true,
				createdCount: result.created_count || 0,
				message: result.message,
				warnings: result.warnings || []
			};
		} catch (err) {
			console.error('Upload error:', err);
			return fail(500, {
				uploadError: true,
				message: 'Internal server error during file upload'
			});
		}
	},

	/**
	 * Fetches available microduct status options for select inputs.
	 * @param {object} event - SvelteKit action event.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	getMicroductStatusOptions: async ({ fetch, cookies }) => {
		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}attributes_microduct_status/`, {
				credentials: 'include',
				headers
			});
			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch status options' });
			}
			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error fetching status options:', error);
			return fail(500, { error: 'Failed to fetch status options' });
		}
	},

	/**
	 * Updates the status of a microduct. Sends null when statusId is empty or "null".
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing `uuid` and `microduct_status_id`.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	updateMicroductStatus: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const uuid = formData.get('uuid');
		const statusId = formData.get('microduct_status_id');

		if (!uuid) {
			return fail(400, { error: 'Missing microduct UUID' });
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}microduct/${uuid}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					microduct_status_id:
						!statusId || statusId === 'null' ? null : parseInt(String(statusId), 10)
				})
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to update microduct status' });
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error updating microduct status:', error);
			return fail(500, { error: 'Failed to update microduct status' });
		}
	},

	/**
	 * Fetches all microducts belonging to a specific conduit.
	 * @param {object} event - SvelteKit action event.
	 * @param {Request} event.request - Form request containing `uuid` of the parent conduit.
	 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
	 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
	 * @returns {Promise<any>}
	 */
	getMicroducts: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const uuid = formData.get('uuid');

			if (!uuid) {
				return fail(400, { error: 'Missing required parameter: uuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}microduct/all/?uuid_conduit=${uuid}`, {
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch microducts' });
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error fetching microducts:', error);
			return fail(500, { error: 'Failed to fetch microducts' });
		}
	}
};
