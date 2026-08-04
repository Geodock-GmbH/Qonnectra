import type { PageServerLoad } from './$types';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

interface TraceLoadOptions {
	includeGeometry: boolean;
	geometryMode: string;
	orientGeometry: boolean;
}

interface TraceLoadResult {
	result?: unknown;
	error?: string;
	entryType: string;
	entryId: string;
	options?: TraceLoadOptions;
}

/**
 * Loads fiber trace data for a given residential unit.
 */
export const load: PageServerLoad = async ({
	fetch,
	cookies,
	params,
	url
}): Promise<TraceLoadResult> => {
	const { uuid } = params;
	const includeGeometry = url.searchParams.get('include_geometry') === 'true';
	const geometryMode = url.searchParams.get('geometry_mode') || 'segments';
	const orientGeometry = url.searchParams.get('orient_geometry') === 'true';

	const headers = getAuthHeaders(cookies);

	let apiUrl = `${API_URL}fiber-trace/?residential_unit_id=${uuid}&include_geometry=${includeGeometry}`;
	if (includeGeometry) {
		apiUrl += `&geometry_mode=${geometryMode}&orient_geometry=${orientGeometry}`;
	}

	try {
		const response = await fetch(apiUrl, { method: 'GET', headers });

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				error: errorData.error || 'Trace failed',
				entryType: 'residential_unit',
				entryId: uuid
			};
		}

		const result: unknown = await response.json();
		return {
			result,
			entryType: 'residential_unit',
			entryId: uuid,
			options: { includeGeometry, geometryMode, orientGeometry }
		};
	} catch (err) {
		console.error('Trace error:', err);
		return {
			error: 'Internal server error',
			entryType: 'residential_unit',
			entryId: uuid
		};
	}
};
