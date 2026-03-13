import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * @typedef {Object} NodeType
 * @property {string} uuid - Node type UUID
 * @property {string} name - Node type display name
 * @property {string} [color] - Optional hex color code
 */

/**
 * @typedef {Object} Surface
 * @property {string} uuid - Surface UUID
 * @property {string} name - Surface display name
 * @property {string} [color] - Optional hex color code
 */

/**
 * @typedef {Object} ConstructionType
 * @property {string} uuid - Construction type UUID
 * @property {string} name - Construction type display name
 * @property {string} [color] - Optional hex color code
 */

/**
 * @typedef {Object} AreaType
 * @property {string} uuid - Area type UUID
 * @property {string} name - Area type display name
 * @property {string} [color] - Optional hex color code
 */

/**
 * Fetches node types for layer styling.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{nodeTypes: NodeType[], nodeTypesError: string | null}>} Node types or error message
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
		return { nodeTypes: [], nodeTypesError: /** @type {Error} */ (err).message };
	}
}

/**
 * Fetches surface types for trench styling.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{surfaces: Surface[], surfacesError: string | null}>} Surfaces or error message
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
		return { surfaces: [], surfacesError: /** @type {Error} */ (err).message };
	}
}

/**
 * Fetches construction types for trench styling.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{constructionTypes: ConstructionType[], constructionTypesError: string | null}>} Construction types or error message
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
		return { constructionTypes: [], constructionTypesError: /** @type {Error} */ (err).message };
	}
}

/**
 * Fetches area types for area styling.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @returns {Promise<{areaTypes: AreaType[], areaTypesError: string | null}>} Area types or error message
 */
export async function getAreaTypes(fetch, cookies) {
	try {
		const response = await fetch(`${API_URL}attributes_area_type/`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch area types: ${response.status}`);
			return { areaTypes: [], areaTypesError: 'Failed to load area types' };
		}

		const areaTypes = await response.json();
		return { areaTypes, areaTypesError: null };
	} catch (err) {
		console.error('Error fetching area types:', err);
		return { areaTypes: [], areaTypesError: /** @type {Error} */ (err).message };
	}
}
