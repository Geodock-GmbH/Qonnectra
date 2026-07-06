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
 * Loads a single pipeline record with the project/type/reason option lists.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const { uuid } = params;

	try {
		const [recordResponse, typeResponse, reasonResponse, projectResponse, areasResponse] =
			await Promise.all([
				fetch(`${API_URL}pipeline-records/${uuid}/`, { credentials: 'include', headers }),
				fetch(`${API_URL}type-of-work/`, { credentials: 'include', headers }),
				fetch(`${API_URL}request-reasons/`, { credentials: 'include', headers }),
				fetch(`${API_URL}projects/?active=1`, { credentials: 'include', headers }),
				fetch(`${API_URL}pipeline-inquiry-areas/?pipeline_record=${uuid}`, {
					credentials: 'include',
					headers
				})
			]);

		if (!recordResponse.ok) {
			console.error(`Failed to fetch pipeline record: ${recordResponse.status}`);
			return {
				record: null,
				recordError: 'Failed to fetch pipeline record',
				typeOfWorkOptions: [],
				requestReasonOptions: [],
				projectOptions: [],
				inquiryAreaCount: 0
			};
		}

		const record = await recordResponse.json();

		const [typeData, reasonData, projectData, areasData] = await Promise.all([
			typeResponse.ok ? typeResponse.json() : [],
			reasonResponse.ok ? reasonResponse.json() : [],
			projectResponse.ok ? projectResponse.json() : [],
			areasResponse.ok ? areasResponse.json() : { features: [] }
		]);

		return {
			record,
			recordError: null,
			typeOfWorkOptions: mapLookupOptions(typeData),
			requestReasonOptions: mapLookupOptions(reasonData),
			projectOptions: mapProjectOptions(projectData),
			inquiryAreaCount: areasData.features?.length ?? 0
		};
	} catch (err) {
		console.error('Error fetching pipeline record:', err);
		return {
			record: null,
			recordError: 'Error occurred while fetching pipeline record',
			typeOfWorkOptions: [],
			requestReasonOptions: [],
			projectOptions: [],
			inquiryAreaCount: 0
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/** PATCHes the pipeline record fields from form data. */
	updatePipelineRecord: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const { uuid } = params;

		try {
			const requestBody = buildRequestBody(formData);

			const response = await fetch(`${API_URL}pipeline-records/${uuid}/`, {
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
				console.error('PATCH error response:', errorData);
				return fail(response.status, {
					message: flattenError(errorData, 'Failed to update pipeline record')
				});
			}

			const updatedRecord = await response.json();
			return {
				success: true,
				message: 'Pipeline record updated successfully',
				record: updatedRecord
			};
		} catch (/** @type {any} */ err) {
			console.error('Error updating pipeline record:', err);
			return fail(500, { message: err.message || 'Failed to update pipeline record' });
		}
	},

	/** Deletes the pipeline record and redirects to the list page. */
	deletePipelineRecord: async ({ fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const { uuid } = params;

		try {
			const response = await fetch(`${API_URL}pipeline-records/${uuid}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: flattenError(errorData, 'Failed to delete pipeline record')
				});
			}

			redirect(303, '/pipeline-records');
		} catch (/** @type {any} */ err) {
			if (err.status === 303) throw err;
			console.error('Error deleting pipeline record:', err);
			return fail(500, { message: err.message || 'Failed to delete pipeline record' });
		}
	}
};
