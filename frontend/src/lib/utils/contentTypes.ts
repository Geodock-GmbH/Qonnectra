import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Django ContentType ID mapping for different feature models.
 *
 * Dynamically fetched from the Django database via the /api/v1/content-types/ endpoint.
 * This eliminates the need for hardcoded IDs and ensures the mapping is always accurate.
 * Cached in memory to minimize API calls.
 */

let contentTypeCache: Record<string, number> | null = null;

let fetchPromise: Promise<Record<string, number>> | null = null;

/**
 * Fetches ContentType IDs from the Django API and transforms them into a lookup map.
 */
async function fetchContentTypesFromAPI(): Promise<Record<string, number>> {
	const response = await fetch(`${PUBLIC_API_URL}content-types/`, {
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch content types: ${response.status}`);
	}

	const contentTypes: Array<{ model: string; id: number }> = await response.json();

	const mapping: Record<string, number> = {};
	contentTypes.forEach((ct) => {
		mapping[ct.model] = ct.id;
	});

	return mapping;
}

/**
 * Returns all ContentType mappings, fetching from the API on first call and caching the result.
 * Deduplicates concurrent requests by reusing an in-flight promise.
 */
export async function fetchContentTypes(): Promise<Record<string, number>> {
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
 * @param featureType - The feature type (e.g., 'node', 'cable', 'trench').
 */
export function getContentTypeId(featureType: string): number | null {
	if (contentTypeCache === null) {
		console.warn('ContentType cache not loaded yet. Call fetchContentTypes() first.');
		return null;
	}
	return contentTypeCache[featureType] || null;
}

/**
 * Checks whether a feature type exists in the ContentType cache.
 * @param featureType - The feature type to validate.
 */
export function isSupportedFeatureType(featureType: string): boolean {
	if (contentTypeCache === null) {
		return false;
	}
	return featureType in contentTypeCache;
}

/**
 * Clears the in-memory ContentType cache, forcing a fresh fetch on next access.
 */
export function clearContentTypeCache(): void {
	contentTypeCache = null;
	fetchPromise = null;
}
