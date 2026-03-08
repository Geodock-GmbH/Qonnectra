import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

export const actions = {
	trace: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const traceType = formData.get('traceType');
		const traceId = formData.get('traceId');
		const includeGeometry = formData.get('includeGeometry') === 'on';

		if (!traceId) {
			return fail(400, { error: 'ID is required' });
		}

		const headers = getAuthHeaders(cookies);
		const paramName = `${traceType}_id`;

		try {
			const response = await fetch(
				`${API_URL}fiber-trace/?${paramName}=${traceId}&include_geometry=${includeGeometry}`,
				{
					method: 'GET',
					headers
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, { error: errorData.error || 'Trace failed' });
			}

			const result = await response.json();
			return { success: true, result };
		} catch (err) {
			console.error('Trace error:', err);
			return fail(500, { error: 'Internal server error' });
		}
	}
};
