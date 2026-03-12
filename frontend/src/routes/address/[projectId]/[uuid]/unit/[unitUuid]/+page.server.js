import { fail, redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Loads a residential unit with type/status options and fiber connections.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const { projectId, uuid: addressUuid, unitUuid } = params;

	try {
		const [unitResponse, typesResponse, statusesResponse, fiberConnectionsResponse] =
			await Promise.all([
				fetch(`${API_URL}residential-unit/${unitUuid}/`, {
					credentials: 'include',
					headers
				}),
				fetch(`${API_URL}attributes_residential_unit_type/`, {
					credentials: 'include',
					headers
				}),
				fetch(`${API_URL}attributes_residential_unit_status/`, {
					credentials: 'include',
					headers
				}),
				fetch(`${API_URL}residential-unit/${unitUuid}/fiber-connections/`, {
					credentials: 'include',
					headers
				})
			]);

		if (!unitResponse.ok) {
			console.error(`Failed to fetch residential unit: ${unitResponse.status}`);
			return {
				unit: null,
				unitError: 'Failed to fetch residential unit',
				projectId,
				addressUuid,
				residentialUnitTypes: [],
				residentialUnitStatuses: [],
				fiberConnections: []
			};
		}

		const unit = await unitResponse.json();

		const [typesData, statusesData, fiberConnectionsData] = await Promise.all([
			typesResponse.ok ? typesResponse.json() : [],
			statusesResponse.ok ? statusesResponse.json() : [],
			fiberConnectionsResponse.ok ? fiberConnectionsResponse.json() : []
		]);

		const residentialUnitTypes = typesData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.residential_unit_type
		}));

		const residentialUnitStatuses = statusesData.map((/** @type {any} */ item) => ({
			value: item.id,
			label: item.status
		}));

		return {
			unit,
			unitError: null,
			projectId,
			addressUuid,
			residentialUnitTypes,
			residentialUnitStatuses,
			fiberConnections: fiberConnectionsData
		};
	} catch (err) {
		console.error('Error fetching residential unit:', err);
		return {
			unit: null,
			unitError: 'Error occurred while fetching residential unit',
			projectId,
			addressUuid,
			residentialUnitTypes: [],
			residentialUnitStatuses: [],
			fiberConnections: []
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/** PATCHes residential unit fields from form data. */
	updateResidentialUnit: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const { unitUuid } = params;

		try {
			/** @type {Record<string, any>} */ const requestBody = {};

			const id_residential_unit = formData.get('id_residential_unit');
			const floor = formData.get('floor');
			const side = formData.get('side');
			const building_section = formData.get('building_section');
			const residential_unit_type_id = formData.get('residential_unit_type_id');
			const status_id = formData.get('status_id');
			const external_id_1 = formData.get('external_id_1');
			const external_id_2 = formData.get('external_id_2');
			const resident_name = formData.get('resident_name');
			const resident_recorded_date = formData.get('resident_recorded_date');
			const ready_for_service = formData.get('ready_for_service');

			if (id_residential_unit !== null)
				requestBody.id_residential_unit = id_residential_unit || null;
			if (floor !== null) requestBody.floor = floor ? parseInt(String(floor)) : null;
			if (side !== null) requestBody.side = side || null;
			if (building_section !== null) requestBody.building_section = building_section || null;
			if (residential_unit_type_id)
				requestBody.residential_unit_type_id = parseInt(String(residential_unit_type_id));
			if (status_id) requestBody.status_id = parseInt(String(status_id));
			if (external_id_1 !== null) requestBody.external_id_1 = external_id_1 || null;
			if (external_id_2 !== null) requestBody.external_id_2 = external_id_2 || null;
			if (resident_name !== null) requestBody.resident_name = resident_name || null;
			if (resident_recorded_date !== null)
				requestBody.resident_recorded_date = resident_recorded_date || null;
			if (ready_for_service !== null) requestBody.ready_for_service = ready_for_service || null;

			const response = await fetch(`${API_URL}residential-unit/${unitUuid}/`, {
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
				const message =
					errorData.detail ||
					Object.entries(errorData)
						.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
						.join('; ') ||
					'Failed to update residential unit';
				return fail(response.status, { message });
			}

			const updatedUnit = await response.json();
			return {
				success: true,
				message: 'Residential unit updated successfully',
				unit: updatedUnit
			};
		} catch (/** @type {any} */ err) {
			console.error('Error updating residential unit:', err);
			return fail(500, { message: err.message || 'Failed to update residential unit' });
		}
	},

	/** Deletes the residential unit and redirects to the address detail page. */
	deleteResidentialUnit: async ({ fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const { projectId, uuid: addressUuid, unitUuid } = params;

		try {
			const response = await fetch(`${API_URL}residential-unit/${unitUuid}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to delete residential unit'
				});
			}

			redirect(303, `/address/${projectId}/${addressUuid}`);
		} catch (/** @type {any} */ err) {
			if (err.status === 303) throw err;
			console.error('Error deleting residential unit:', err);
			return fail(500, { message: err.message || 'Failed to delete residential unit' });
		}
	},

	/** Triggers backend ID regeneration for the residential unit. */
	regenerateId: async ({ fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const { unitUuid } = params;

		try {
			const response = await fetch(`${API_URL}residential-unit/${unitUuid}/regenerate-id/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to regenerate residential unit ID'
				});
			}

			const updatedData = await response.json();
			const id_residential_unit = updatedData.id_residential_unit;
			return { success: true, id_residential_unit };
		} catch (/** @type {any} */ err) {
			console.error('Error regenerating residential unit ID:', err);
			return fail(500, {
				message: err.message || 'Failed to regenerate residential unit ID'
			});
		}
	}
};
