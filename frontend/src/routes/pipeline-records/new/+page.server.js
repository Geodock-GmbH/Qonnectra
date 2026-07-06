import { fail, redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

import {
	buildRequestBody,
	flattenError,
	mapLookupOptions,
	mapProjectOptions
} from '../pipelineRecordApi.js';

/**
 * Loads the project/type/reason option lists for the create form.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch, cookies }) {
	const headers = getAuthHeaders(cookies);

	try {
		const [typeResponse, reasonResponse, projectResponse] = await Promise.all([
			fetch(`${API_URL}type-of-work/`, { credentials: 'include', headers }),
			fetch(`${API_URL}request-reasons/`, { credentials: 'include', headers }),
			fetch(`${API_URL}projects/?active=1`, { credentials: 'include', headers })
		]);

		const [typeData, reasonData, projectData] = await Promise.all([
			typeResponse.ok ? typeResponse.json() : [],
			reasonResponse.ok ? reasonResponse.json() : [],
			projectResponse.ok ? projectResponse.json() : []
		]);

		const projectOptions = mapProjectOptions(projectData);

		// The create form's project is fixed to the app's active project (top selector).
		const selectedProject = cookies.get('selected-project');
		const activeProject =
			projectOptions.find((o) => String(o.value) === String(selectedProject)) || projectOptions[0];

		return {
			typeOfWorkOptions: mapLookupOptions(typeData),
			requestReasonOptions: mapLookupOptions(reasonData),
			projectOptions,
			activeProjectId: activeProject ? activeProject.value : ''
		};
	} catch (err) {
		console.error('Error fetching pipeline record options:', err);
		return {
			typeOfWorkOptions: [],
			requestReasonOptions: [],
			projectOptions: [],
			activeProjectId: ''
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/** POSTs a new pipeline record and redirects to its detail page. */
	createPipelineRecord: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		try {
			const requestBody = buildRequestBody(formData);

			const response = await fetch(`${API_URL}pipeline-records/`, {
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
				console.error('POST error response:', errorData);
				return fail(response.status, {
					message: flattenError(errorData, 'Failed to create pipeline record')
				});
			}

			const createdRecord = await response.json();

			redirect(303, `/pipeline-records/${createdRecord.uuid}`);
		} catch (/** @type {any} */ err) {
			if (err.status === 303) throw err;
			console.error('Error creating pipeline record:', err);
			return fail(500, { message: err.message || 'Failed to create pipeline record' });
		}
	}
};
