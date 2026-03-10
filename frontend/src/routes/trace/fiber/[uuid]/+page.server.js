import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

export async function load({ fetch, cookies, params, url }) {
	const { uuid } = params;
	const mode = url.searchParams.get('mode') || 'trace';
	const signalSource = url.searchParams.get('source');
	const includeGeometry = url.searchParams.get('include_geometry') === 'true';
	const geometryMode = url.searchParams.get('geometry_mode') || 'segments';
	const orientGeometry = url.searchParams.get('orient_geometry') === 'true';

	const headers = getAuthHeaders(cookies);

	let apiUrl;
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

		const result = await response.json();
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
}
