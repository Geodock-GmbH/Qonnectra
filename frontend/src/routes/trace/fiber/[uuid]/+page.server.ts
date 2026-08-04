import type { PageServerLoad } from './$types';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

interface FiberTraceLoadOptions {
	includeGeometry: boolean;
	geometryMode: string;
	orientGeometry: boolean;
	signalSource: string | null;
}

interface FiberTraceLoadResult {
	result?: unknown;
	error?: string;
	entryType: string;
	entryId: string;
	mode: string;
	options?: FiberTraceLoadOptions;
}

/**
 * Loads fiber trace or signal analysis data for a given fiber.
 * Supports both standard trace and signal analysis modes via the `mode` query param.
 */
export const load: PageServerLoad = async ({
	fetch,
	cookies,
	params,
	url
}): Promise<FiberTraceLoadResult> => {
	const { uuid } = params;
	const mode = url.searchParams.get('mode') || 'trace';
	const signalSource = url.searchParams.get('source');
	let includeGeometry = url.searchParams.get('include_geometry') === 'true';
	let geometryMode = url.searchParams.get('geometry_mode') || 'segments';
	const orientGeometry = url.searchParams.get('orient_geometry') === 'true';

	if (mode === 'signal') {
		includeGeometry = true;
		geometryMode = 'routed';
	}

	const headers = getAuthHeaders(cookies);

	let apiUrl: string;
	if (mode === 'signal') {
		apiUrl = `${API_URL}signal-analysis/?fiber_id=${uuid}&include_geometry=${includeGeometry}`;
		if (signalSource) {
			apiUrl += `&signal_source_node_id=${signalSource}`;
		}
	} else {
		apiUrl = `${API_URL}fiber-trace/?fiber_id=${uuid}&include_geometry=${includeGeometry}`;
	}

	if (includeGeometry) {
		apiUrl += `&geometry_mode=${geometryMode}&orient_geometry=${orientGeometry}`;
	}

	try {
		const response = await fetch(apiUrl, { method: 'GET', headers });

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				error: errorData.error || 'Trace failed',
				entryType: 'fiber',
				entryId: uuid,
				mode
			};
		}

		const result: unknown = await response.json();
		return {
			result,
			entryType: 'fiber',
			entryId: uuid,
			mode,
			options: { includeGeometry, geometryMode, orientGeometry, signalSource }
		};
	} catch (err) {
		console.error('Trace error:', err);
		return {
			error: 'Internal server error',
			entryType: 'fiber',
			entryId: uuid,
			mode
		};
	}
};
