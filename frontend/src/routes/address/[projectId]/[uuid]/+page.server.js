import { fail, redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const { projectId, uuid } = params;

	try {
		// Fetch address and select options in parallel
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
				flags: []
			};
		}

		const addressData = await addressResponse.json();
		// GeoFeatureModelSerializer returns GeoJSON format - extract properties and id
		const address = {
			...(addressData.properties || addressData),
			uuid: addressData.id || addressData.properties?.uuid || addressData.uuid
		};

		// Process select options
		const [statusDevelopmentsData, flagsData] = await Promise.all(
			selectResponses.map((res) => (res.ok ? res.json() : []))
		);

		const statusDevelopments = statusDevelopmentsData.map((item) => ({
			value: item.id,
			label: item.status_development
		}));

		const flags = flagsData.map((item) => ({
			value: item.id,
			label: item.flag
		}));

		return {
			address,
			addressError: null,
			projectId,
			statusDevelopments,
			flags
		};
	} catch (err) {
		console.error('Error fetching address:', err);
		return {
			address: null,
			addressError: 'Error occurred while fetching address',
			projectId,
			statusDevelopments: [],
			flags: []
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * Update an existing address
	 */
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

		try {
			const requestBody = {};
			// Required fields - always include
			if (street) requestBody.street = street;
			if (housenumber) requestBody.housenumber = parseInt(housenumber);
			if (zip_code) requestBody.zip_code = zip_code;
			if (city) requestBody.city = city;

			// Optional text fields - only include if they have a value
			if (house_number_suffix) requestBody.house_number_suffix = house_number_suffix;
			if (district) requestBody.district = district;

			// Foreign keys - only include if a valid ID is selected
			if (status_development_id)
				requestBody.status_development_id = parseInt(status_development_id);
			if (flag_id) requestBody.flag_id = parseInt(flag_id);

			console.log('PATCH request body:', JSON.stringify(requestBody));

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
				// Handle both 'detail' (DRF standard) and field-level errors
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

	/**
	 * Delete an address
	 */
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

			// Redirect to list page after successful deletion
			redirect(303, `/address/${projectId}`);
		} catch (err) {
			// If it's a redirect, rethrow it
			if (err.status === 303) throw err;
			console.error('Error deleting address:', err);
			return fail(500, { message: err.message || 'Failed to delete address' });
		}
	}
};
