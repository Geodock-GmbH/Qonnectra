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
			fetch(`${API_URL}flags/`, { credentials: 'include', headers: headers })
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

		const [statusDevelopmentsData, flagsData] = await Promise.all(
			selectResponses.map((res) => (res.ok ? res.json() : []))
		);

		const statusDevelopments = statusDevelopmentsData.map((item) => ({
			value: item.id,
			label: item.status
		}));

		const flags = flagsData.map((item) => ({
			value: item.id,
			label: item.flag
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

		return {
			address,
			addressError: null,
			projectId,
			statusDevelopments,
			flags,
			linkedNodes,
			linkedMicroducts
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
			linkedMicroducts: []
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
	}
};
