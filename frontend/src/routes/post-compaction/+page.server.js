import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Load status development options for the post-compaction page.
 * @param {import('./$types').PageServerLoadEvent} event - SvelteKit load event.
 * @returns {Promise<{ statusDevelopments: Array<{ value: string, label: string }> }>} Mapped select options.
 */
export async function load({ fetch, cookies }) {
	const headers = getAuthHeaders(cookies);

	try {
		const response = await fetch(`${API_URL}attributes_status_development/`, {
			credentials: 'include',
			headers
		});

		if (!response.ok) {
			return { statusDevelopments: [] };
		}

		const data = await response.json();
		const statusDevelopments = data.map((/** @type {any} */ item) => ({
			value: String(item.id),
			label: item.status
		}));

		return { statusDevelopments };
	} catch {
		return { statusDevelopments: [] };
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * PATCH an address's status_development field.
	 * @param {import('./$types').RequestEvent} event - SvelteKit request event.
	 * @returns {Promise<{ success: true, address: Record<string, any> } | import('@sveltejs/kit').ActionFailure>}
	 */
	updateStatus: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const uuid = formData.get('uuid');
		const statusDevelopmentId = formData.get('status_development_id');

		try {
			const response = await fetch(`${API_URL}address/${uuid}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status_development_id: parseInt(String(statusDevelopmentId))
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const message =
					errorData.detail ||
					Object.entries(errorData)
						.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
						.join('; ') ||
					'Failed to update status';
				return fail(response.status, { message });
			}

			const updatedData = await response.json();
			const address = {
				...(updatedData.properties || updatedData),
				uuid: updatedData.id || updatedData.properties?.uuid || updatedData.uuid
			};

			return { success: true, address };
		} catch (/** @type {any} */ err) {
			return fail(500, { message: err.message || 'Failed to update status' });
		}
	},

	/**
	 * Fetch a single address with its residential units by UUID.
	 * @param {import('./$types').RequestEvent} event - SvelteKit request event.
	 * @returns {Promise<{ success: true, address: Record<string, any>, residentialUnits: Record<string, any>[] } | import('@sveltejs/kit').ActionFailure>}
	 */
	fetchAddress: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const uuid = formData.get('uuid');

		try {
			const [addressResponse, residentialUnitsResponse] = await Promise.all([
				fetch(`${API_URL}address/${uuid}/`, {
					credentials: 'include',
					headers
				}),
				fetch(`${API_URL}residential-unit/all/?uuid_address=${uuid}`, {
					credentials: 'include',
					headers
				})
			]);

			if (!addressResponse.ok) {
				const errorData = await addressResponse.json().catch(() => ({}));
				return fail(addressResponse.status, {
					message: errorData.detail || 'Failed to fetch address'
				});
			}

			const addressData = await addressResponse.json();
			const address = {
				...(addressData.properties || addressData),
				uuid: addressData.id || addressData.properties?.uuid || addressData.uuid
			};

			let residentialUnits = [];
			if (residentialUnitsResponse.ok) {
				residentialUnits = await residentialUnitsResponse.json();
			}

			return { success: true, address, residentialUnits };
		} catch (/** @type {any} */ err) {
			return fail(500, { message: err.message || 'Failed to fetch address' });
		}
	}
};
