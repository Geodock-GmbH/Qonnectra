import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Django ContentType ID mapping for different feature models.
 *
 * Dynamically fetched from the Django database via the /api/v1/content-types/ endpoint.
 * This eliminates the need for hardcoded IDs and ensures the mapping is always accurate.
 * Cached in memory to minimize API calls.
 */

/** @type {Record<string, number> | null} */
let contentTypeCache = null;

/** @type {Promise<Record<string, number>> | null} */
let fetchPromise = null;

/**
 * Fetches ContentType IDs from the Django API and transforms them into a lookup map.
 * @returns {Promise<Record<string, number>>} Mapping of model names to ContentType IDs.
 */
async function fetchContentTypesFromAPI() {
	const response = await fetch(`${PUBLIC_API_URL}content-types/`, {
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch content types: ${response.status}`);
	}

	const contentTypes = await response.json();

	/** @type {Record<string, number>} */
	const mapping = {};
	contentTypes.forEach((/** @type {{ model: string; id: number }} */ ct) => {
		mapping[ct.model] = ct.id;
	});

	return mapping;
}

/**
 * Returns all ContentType mappings, fetching from the API on first call and caching the result.
 * Deduplicates concurrent requests by reusing an in-flight promise.
 * @returns {Promise<Record<string, number>>} Mapping of model names to ContentType IDs.
 */
export async function fetchContentTypes() {
	if (contentTypeCache !== null) {
		return contentTypeCache;
	}

	if (fetchPromise !== null) {
		return fetchPromise;
	}

	fetchPromise = fetchContentTypesFromAPI();

	try {
		contentTypeCache = await fetchPromise;
		return contentTypeCache;
	} catch (error) {
		fetchPromise = null;
		throw error;
	} finally {
		fetchPromise = null;
	}
}

/**
 * Returns the ContentType ID for a given feature type from the cache.
 * @param {string} featureType - The feature type (e.g., 'node', 'cable', 'trench').
 * @returns {number | null} The ContentType ID, or null if not found or cache not loaded.
 */
export function getContentTypeId(featureType) {
	if (contentTypeCache === null) {
		console.warn('ContentType cache not loaded yet. Call fetchContentTypes() first.');
		return null;
	}
	return contentTypeCache[featureType] || null;
}

/**
 * Checks whether a feature type exists in the ContentType cache.
 * @param {string} featureType - The feature type to validate.
 * @returns {boolean} Whether the feature type is a known ContentType.
 */
export function isSupportedFeatureType(featureType) {
	if (contentTypeCache === null) {
		return false;
	}
	return featureType in contentTypeCache;
}

/**
 * Clears the in-memory ContentType cache, forcing a fresh fetch on next access.
 * @returns {void}
 */
export function clearContentTypeCache() {
	contentTypeCache = null;
	fetchPromise = null;
}
