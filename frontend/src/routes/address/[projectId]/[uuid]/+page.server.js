import { fail, redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const { projectId, uuid } = params;

	try {
		const [addressResponse, ...selectResponses] = await Promise.all([
			fetch(`${API_URL}address/${uuid}/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_status_development/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}flags/`, { credentials: 'include', headers: headers }),
			fetch(`${API_URL}attributes_residential_unit_type/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_residential_unit_status/`, {
				credentials: 'include',
				headers: headers
			})
		]);

		if (!addressResponse.ok) {
			console.error(`Failed to fetch address: ${addressResponse.status}`);
			return {
				address: null,
				addressError: 'Failed to fetch address',
				projectId,
				statusDevelopments: [],
				flags: [],
				linkedNodes: [],
				linkedMicroducts: []
			};
		}

		const addressData = await addressResponse.json();
		// GeoFeatureModelSerializer returns GeoJSON format - extract properties and id
		const address = {
			...(addressData.properties || addressData),
			uuid: addressData.id || addressData.properties?.uuid || addressData.uuid,
			geom_3857: addressData.properties?.geom_3857 || addressData.geom_3857 || null
		};

		const [
			statusDevelopmentsData,
			flagsData,
			residentialUnitTypesData,
			residentialUnitStatusesData
		] = await Promise.all(selectResponses.map((res) => (res.ok ? res.json() : [])));

		const statusDevelopments = statusDevelopmentsData.map((item) => ({
			value: item.id,
			label: item.status
		}));

		const flags = flagsData.map((item) => ({
			value: item.id,
			label: item.flag
		}));

		const residentialUnitTypes = residentialUnitTypesData.map((item) => ({
			value: item.id,
			label: item.residential_unit_type
		}));

		const residentialUnitStatuses = residentialUnitStatusesData.map((item) => ({
			value: item.id,
			label: item.status
		}));

		// Fetch nodes linked to this address
		let linkedNodes = [];
		let linkedMicroducts = [];
		try {
			const nodesResponse = await fetch(`${API_URL}node/?uuid_address=${uuid}`, {
				credentials: 'include',
				headers
			});
			if (nodesResponse.ok) {
				const nodesData = await nodesResponse.json();
				const features = nodesData.features || nodesData.results?.features || [];
				linkedNodes = features.map((f) => ({
					uuid: f.id || f.properties?.uuid,
					name: f.properties?.name || ''
				}));

				// Fetch microducts for each linked node
				if (linkedNodes.length > 0) {
					const microductResponses = await Promise.all(
						linkedNodes.map((node) =>
							fetch(`${API_URL}microduct/all/?uuid_node=${node.uuid}`, {
								credentials: 'include',
								headers
							})
						)
					);
					for (let i = 0; i < microductResponses.length; i++) {
						if (microductResponses[i].ok) {
							const microducts = await microductResponses[i].json();
							for (const md of microducts) {
								linkedMicroducts.push({
									uuid: md.uuid,
									number: md.number,
									color: md.color,
									conduitName: md.uuid_conduit?.name || '',
									conduitType: md.uuid_conduit?.conduit_type?.conduit_type || '',
									nodeName: linkedNodes[i].name,
									nodeUuid: linkedNodes[i].uuid
								});
							}
						}
					}
				}
			}
		} catch (err) {
			console.error('Error fetching linked nodes/microducts:', err);
		}

		// Fetch residential units for this address
		let residentialUnits = [];
		try {
			const residentialUnitsResponse = await fetch(
				`${API_URL}residential-unit/all/?uuid_address=${uuid}`,
				{
					credentials: 'include',
					headers
				}
			);
			if (residentialUnitsResponse.ok) {
				residentialUnits = await residentialUnitsResponse.json();
			}
		} catch (err) {
			console.error('Error fetching residential units:', err);
		}

		return {
			address,
			addressError: null,
			projectId,
			statusDevelopments,
			flags,
			linkedNodes,
			linkedMicroducts,
			residentialUnits,
			residentialUnitTypes,
			residentialUnitStatuses
		};
	} catch (err) {
		console.error('Error fetching address:', err);
		return {
			address: null,
			addressError: 'Error occurred while fetching address',
			projectId,
			statusDevelopments: [],
			flags: [],
			linkedNodes: [],
			linkedMicroducts: [],
			residentialUnits: [],
			residentialUnitTypes: [],
			residentialUnitStatuses: []
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	updateAddress: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const { uuid } = params;

		const street = formData.get('street');
		const housenumber = formData.get('housenumber');
		const house_number_suffix = formData.get('house_number_suffix');
		const zip_code = formData.get('zip_code');
		const city = formData.get('city');
		const district = formData.get('district');
		const status_development_id = formData.get('status_development_id');
		const flag_id = formData.get('flag_id');
		const id_address = formData.get('id_address');

		try {
			const requestBody = {};
			if (street) requestBody.street = street;
			if (housenumber) requestBody.housenumber = parseInt(housenumber);
			if (zip_code) requestBody.zip_code = zip_code;
			if (city) requestBody.city = city;

			if (house_number_suffix) requestBody.house_number_suffix = house_number_suffix;
			if (district) requestBody.district = district;

			if (status_development_id)
				requestBody.status_development_id = parseInt(status_development_id);
			if (flag_id) requestBody.flag_id = parseInt(flag_id);
			if (id_address) requestBody.id_address = id_address.toUpperCase();

			const response = await fetch(`${API_URL}address/${uuid}/`, {
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
					'Failed to update address';
				return fail(response.status, { message });
			}

			const updatedAddressData = await response.json();
			// GeoFeatureModelSerializer returns GeoJSON format - extract properties and id
			const updatedAddress = {
				...(updatedAddressData.properties || updatedAddressData),
				uuid:
					updatedAddressData.id || updatedAddressData.properties?.uuid || updatedAddressData.uuid
			};
			return {
				success: true,
				message: 'Address updated successfully',
				address: updatedAddress
			};
		} catch (err) {
			console.error('Error updating address:', err);
			return fail(500, { message: err.message || 'Failed to update address' });
		}
	},
	regenerateId: async ({ fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const { uuid } = params;

		try {
			const response = await fetch(`${API_URL}address/${uuid}/regenerate-id/`, {
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
					message: errorData.detail || 'Failed to regenerate address ID'
				});
			}

			const updatedData = await response.json();
			const id_address = updatedData.properties?.id_address || updatedData.id_address;
			return { success: true, id_address };
		} catch (err) {
			console.error('Error regenerating address ID:', err);
			return fail(500, { message: err.message || 'Failed to regenerate address ID' });
		}
	},
	deleteAddress: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const { projectId, uuid } = params;

		try {
			const response = await fetch(`${API_URL}address/${uuid}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, { message: errorData.detail || 'Failed to delete address' });
			}

			redirect(303, `/address/${projectId}`);
		} catch (err) {
			if (err.status === 303) throw err;
			console.error('Error deleting address:', err);
			return fail(500, { message: err.message || 'Failed to delete address' });
		}
	},
	createResidentialUnit: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const { uuid } = params;

		try {
			const requestBody = {
				uuid_address_id: uuid
			};

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

			if (id_residential_unit) requestBody.id_residential_unit = id_residential_unit;
			if (floor) requestBody.floor = parseInt(floor);
			if (side) requestBody.side = side;
			if (building_section) requestBody.building_section = building_section;
			if (residential_unit_type_id)
				requestBody.residential_unit_type_id = parseInt(residential_unit_type_id);
			if (status_id) requestBody.status_id = parseInt(status_id);
			if (external_id_1) requestBody.external_id_1 = external_id_1;
			if (external_id_2) requestBody.external_id_2 = external_id_2;
			if (resident_name) requestBody.resident_name = resident_name;
			if (resident_recorded_date) requestBody.resident_recorded_date = resident_recorded_date;
			if (ready_for_service) requestBody.ready_for_service = ready_for_service;

			const response = await fetch(`${API_URL}residential-unit/`, {
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
				console.error('Error creating residential unit:', errorData);
				const message =
					errorData.detail ||
					Object.entries(errorData)
						.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
						.join('; ') ||
					'Failed to create residential unit';
				return fail(response.status, { message });
			}

			const newUnit = await response.json();
			return { success: true, residentialUnit: newUnit };
		} catch (err) {
			console.error('Error creating residential unit:', err);
			return fail(500, { message: err.message || 'Failed to create residential unit' });
		}
	},
	updateResidentialUnit: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const unitUuid = formData.get('unit_uuid');

		try {
			const requestBody = {};

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

			if (floor !== null) requestBody.floor = floor ? parseInt(floor) : null;
			if (side !== null) requestBody.side = side || null;
			if (building_section !== null) requestBody.building_section = building_section || null;
			if (residential_unit_type_id)
				requestBody.residential_unit_type_id = parseInt(residential_unit_type_id);
			if (status_id) requestBody.status_id = parseInt(status_id);
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
				return fail(response.status, {
					message: errorData.detail || 'Failed to update residential unit'
				});
			}

			const updatedUnit = await response.json();
			return { success: true, residentialUnit: updatedUnit };
		} catch (err) {
			console.error('Error updating residential unit:', err);
			return fail(500, { message: err.message || 'Failed to update residential unit' });
		}
	},
	deleteResidentialUnit: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const unitUuid = formData.get('unit_uuid');

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

			return { success: true };
		} catch (err) {
			console.error('Error deleting residential unit:', err);
			return fail(500, { message: err.message || 'Failed to delete residential unit' });
		}
	}
};
