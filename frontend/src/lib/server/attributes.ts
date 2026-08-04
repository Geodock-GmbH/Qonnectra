import type { Cookies } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

export interface NodeType {
	/** Node type UUID */
	uuid: string;
	/** Node type display name */
	name: string;
	/** Optional hex color code */
	color?: string;
}

export interface Surface {
	/** Surface UUID */
	uuid: string;
	/** Surface display name */
	name: string;
	/** Optional hex color code */
	color?: string;
}

export interface ConstructionType {
	/** Construction type UUID */
	uuid: string;
	/** Construction type display name */
	name: string;
	/** Optional hex color code */
	color?: string;
}

export interface AreaType {
	/** Area type UUID */
	uuid: string;
	/** Area type display name */
	name: string;
	/** Optional hex color code */
	color?: string;
}

/** Fetches node types for layer styling. */
export async function getNodeTypes(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ nodeTypes: NodeType[]; nodeTypesError: string | null }> {
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
		return { nodeTypes: [], nodeTypesError: (err as Error).message };
	}
}

/** Fetches surface types for trench styling. */
export async function getSurfaces(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ surfaces: Surface[]; surfacesError: string | null }> {
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
		return { surfaces: [], surfacesError: (err as Error).message };
	}
}

/** Fetches construction types for trench styling. */
export async function getConstructionTypes(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ constructionTypes: ConstructionType[]; constructionTypesError: string | null }> {
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
		return { constructionTypes: [], constructionTypesError: (err as Error).message };
	}
}

/** Fetches area types for area styling. */
export async function getAreaTypes(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<{ areaTypes: AreaType[]; areaTypesError: string | null }> {
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
		return { areaTypes: [], areaTypesError: (err as Error).message };
	}
}
