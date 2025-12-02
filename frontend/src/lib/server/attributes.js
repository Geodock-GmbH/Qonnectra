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

/**
 * Fetch surface types for trench styling
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{surfaces: Array, surfacesError: string|null}>}
 */
export async function getSurfaces(fetch, cookies) {
	try {
		const response = await fetch(`${API_URL}attributes_surface/`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch surfaces: ${response.status}`);
			return { surfaces: [], surfacesError: 'Failed to load surfaces' };
		}

		const surfaces = await response.json();
		return { surfaces, surfacesError: null };
	} catch (err) {
		console.error('Error fetching surfaces:', err);
		return { surfaces: [], surfacesError: err.message };
	}
}

/**
 * Fetch construction types for trench styling
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{constructionTypes: Array, constructionTypesError: string|null}>}
 */
export async function getConstructionTypes(fetch, cookies) {
	try {
		const response = await fetch(`${API_URL}attributes_construction_type/`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch construction types: ${response.status}`);
			return { constructionTypes: [], constructionTypesError: 'Failed to load construction types' };
		}

		const constructionTypes = await response.json();
		return { constructionTypes, constructionTypesError: null };
	} catch (err) {
		console.error('Error fetching construction types:', err);
		return { constructionTypes: [], constructionTypesError: err.message };
	}
}
