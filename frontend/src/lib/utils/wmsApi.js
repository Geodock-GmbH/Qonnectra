/**
 * WMS API functions for fetching WMS sources and layers.
 */

import { PUBLIC_API_URL } from '$env/static/public';

/**
 * @typedef {Object} WMSLayer
 * @property {string} id - Layer UUID
 * @property {string} name - Layer name (as defined in WMS service)
 * @property {string} title - Human-readable layer title
 * @property {boolean} is_enabled - Whether the layer is enabled for display
 * @property {number} sort_order - Display order
 */

/**
 * @typedef {Object} WMSSource
 * @property {string} id - Source UUID
 * @property {string} name - Human-readable source name
 * @property {string} url - WMS service URL
 * @property {boolean} is_active - Whether the source is active
 * @property {string} project - Associated project ID
 * @property {WMSLayer[]} layers - List of layers from this source
 * @property {string} created_at - ISO timestamp of creation
 * @property {string} updated_at - ISO timestamp of last update
 */

/**
 * Fetch WMS sources for a project.
 * @param {string|number} projectId - The project ID
 * @returns {Promise<WMSSource[]>} List of WMS sources with their layers
 * @throws {Error} If the request fails
 */
export async function fetchWMSSources(projectId) {
	const response = await fetch(`${PUBLIC_API_URL}wms-sources/?project=${projectId}`, {
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch WMS sources: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Refresh layers for a WMS source by fetching GetCapabilities.
 * @param {string} sourceId - The WMS source UUID
 * @returns {Promise<WMSSource>} Updated WMS source with refreshed layers
 * @throws {Error} If the request fails
 */
export async function refreshWMSLayers(sourceId) {
	const response = await fetch(`${PUBLIC_API_URL}wms-sources/${sourceId}/refresh_layers/`, {
		method: 'POST',
		credentials: 'include'
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || `Failed to refresh WMS layers: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get the WMS proxy URL for a source.
 * @param {string} sourceId - The WMS source UUID
 * @returns {string} The proxy URL
 */
export function getWMSProxyUrl(sourceId) {
	return `${PUBLIC_API_URL}wms-proxy/${sourceId}/`;
}
