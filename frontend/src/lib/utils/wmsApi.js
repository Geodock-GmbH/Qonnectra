import { PUBLIC_API_URL } from '$env/static/public';

/**
 * @typedef {Object} WMSLayer
 * @property {string} id - Layer UUID.
 * @property {string} name - Layer name (as defined in WMS service).
 * @property {string} title - Human-readable layer title.
 * @property {boolean} is_enabled - Whether the layer is enabled for display.
 * @property {number} sort_order - Display order.
 * @property {number} [min_zoom] - Minimum zoom level.
 * @property {number} [max_zoom] - Maximum zoom level.
 * @property {number} [opacity] - Layer opacity (0–1).
 */

/**
 * @typedef {Object} WMSSource
 * @property {string} id - Source UUID.
 * @property {string} name - Human-readable source name.
 * @property {string} url - WMS service URL.
 * @property {boolean} is_active - Whether the source is active.
 * @property {string} project - Associated project ID.
 * @property {WMSLayer[]} layers - Layers from this source.
 * @property {string} created_at - ISO timestamp of creation.
 * @property {string} updated_at - ISO timestamp of last update.
 */

/**
 * Fetches WMS sources and their layers for a project.
 * @param {string | number} projectId - The project ID.
 * @returns {Promise<WMSSource[]>} List of WMS sources with their layers.
 * @throws {Error} If the request fails.
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
 * Triggers a GetCapabilities refresh for a WMS source, updating its layer list.
 * @param {string} sourceId - The WMS source UUID.
 * @returns {Promise<WMSSource>} The updated WMS source with refreshed layers.
 * @throws {Error} If the request fails.
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
 * Constructs the WMS proxy URL for a source, optionally including an access token.
 * @param {string} sourceId - The WMS source UUID.
 * @param {string} [token] - Access token for authentication (appended as query parameter).
 * @returns {string} The proxy URL.
 */
export function getWMSProxyUrl(sourceId, token) {
	const baseUrl = `${PUBLIC_API_URL}wms-proxy/${sourceId}/`;
	if (token) {
		return `${baseUrl}?token=${encodeURIComponent(token)}`;
	}
	return baseUrl;
}

/**
 * Fetches a short-lived access token for WMS tile requests.
 * Browser image requests don't include cookies due to SameSite restrictions,
 * so this token is passed as a query parameter instead.
 * @returns {Promise<string>} The access token string.
 * @throws {Error} If the request fails.
 */
export async function fetchWMSAccessToken() {
	const response = await fetch(`${PUBLIC_API_URL}wms-sources/access_token/`, {
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch WMS access token: ${response.statusText}`);
	}

	const data = await response.json();
	return data.token;
}
