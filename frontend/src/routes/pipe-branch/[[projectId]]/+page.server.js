import { API_URL } from '$env/static/private';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, params, cookies }) {
	const { projectId } = params;

	if (!projectId) {
		return { nodes: [] };
	}

	try {
		const response = await fetch(`${API_URL}node/all/?project=${projectId}&group=RAB`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch nodes: ${response.status}`);
			return { nodes: [] };
		}

		const data = await response.json();

		if (
			typeof data === 'object' &&
			data !== null &&
			data.type === 'FeatureCollection' &&
			Array.isArray(data.features)
		) {
			const nodes = data.features.map((feature) => ({
				label: feature.properties.name,
				value: feature.properties.name
			}));
			return { nodes };
		} else {
			console.error('Invalid GeoJSON FeatureCollection structure:', data);
			return { nodes: [] };
		}
	} catch (error) {
		console.error('Error fetching data:', error);
		return { nodes: [] };
	}
}

function getAuthHeaders(cookies) {
	const accessToken = cookies.get('api-access-token');
	const headers = new Headers();
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}
	return headers;
}
