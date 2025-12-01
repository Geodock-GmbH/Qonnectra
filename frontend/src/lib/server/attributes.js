import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Fetch node types for layer styling
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{nodeTypes: Array, nodeTypesError: string|null}>}
 */
export async function getNodeTypes(fetch, cookies) {
	try {
		const response = await fetch(`${API_URL}attributes_node_type/`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch node types: ${response.status}`);
			return { nodeTypes: [], nodeTypesError: 'Failed to load node types' };
		}

		const nodeTypes = await response.json();
		return { nodeTypes, nodeTypesError: null };
	} catch (err) {
		console.error('Error fetching node types:', err);
		return { nodeTypes: [], nodeTypesError: err.message };
	}
}
