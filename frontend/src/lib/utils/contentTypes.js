import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Django ContentType ID mapping for different feature models
 *
 * Dynamically fetched from the Django database via the /api/v1/content-types/ endpoint.
 * This eliminates the need for hardcoded IDs and ensures the mapping is always accurate.
 *
 * Cached in memory to minimize API calls.
 */

// In-memory cache for ContentType mappings
let contentTypeCache = null;
let fetchPromise = null;

/**
 * Fetch ContentType IDs from Django API
 * @returns {Promise<Object>} Object mapping model names to ContentType IDs
 */
async function fetchContentTypesFromAPI() {
	const response = await fetch(`${PUBLIC_API_URL}content-types/`, {
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch content types: ${response.status}`);
	}

	const contentTypes = await response.json();

	// Transform array of {id, app_label, model} into {model: id} object
	const mapping = {};
	contentTypes.forEach((ct) => {
		mapping[ct.model] = ct.id;
	});

	return mapping;
}

/**
 * Get all ContentType mappings (cached)
 * @returns {Promise<Object>} Object mapping model names to ContentType IDs
 */
export async function fetchContentTypes() {
	// Return cached data if available
	if (contentTypeCache !== null) {
		return contentTypeCache;
	}

	// Return existing promise if already fetching
	if (fetchPromise !== null) {
		return fetchPromise;
	}

	// Fetch and cache
	fetchPromise = fetchContentTypesFromAPI();

	try {
		contentTypeCache = await fetchPromise;
		return contentTypeCache;
	} catch (error) {
		// Reset on error so next call will retry
		fetchPromise = null;
		throw error;
	} finally {
		fetchPromise = null;
	}
}

/**
 * Get ContentType ID for a given feature type
 * @param {string} featureType - The feature type (e.g., 'node', 'cable', 'trench')
 * @returns {number|null} The ContentType ID or null if not found/loaded
 */
export function getContentTypeId(featureType) {
	if (contentTypeCache === null) {
		console.warn('ContentType cache not loaded yet. Call fetchContentTypes() first.');
		return null;
	}
	return contentTypeCache[featureType] || null;
}

/**
 * Validate if a feature type is supported for file uploads
 * @param {string} featureType - The feature type to validate
 * @returns {boolean} True if the feature type supports file uploads
 */
export function isSupportedFeatureType(featureType) {
	if (contentTypeCache === null) {
		return false;
	}
	return featureType in contentTypeCache;
}

/**
 * Clear the ContentType cache (useful for testing or forcing refresh)
 */
export function clearContentTypeCache() {
	contentTypeCache = null;
	fetchPromise = null;
}
