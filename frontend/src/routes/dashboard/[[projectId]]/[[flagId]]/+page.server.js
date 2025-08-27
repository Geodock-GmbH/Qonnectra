import { API_URL } from '$env/static/private';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, params, cookies }) {
	const { projectId } = params;

	if (!projectId) {
		return { totalLength: 0, count: 0, lengthByTypes: [] };
	}

	try {
		const [trenchResponse, lengthByTypesResponse, nodesByTypeResponse] = await Promise.all([
			fetch(`${API_URL}trench/total_length/?project=${projectId}`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			}),
			fetch(`${API_URL}trench/length_by_types/?project=${projectId}`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			}),
			fetch(`${API_URL}node/count_of_nodes_by_type/?project=${projectId}`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			})
		]);

		if (!trenchResponse.ok) {
			console.error(`Failed to fetch trenches: ${trenchResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [] };
		}

		if (!lengthByTypesResponse.ok) {
			console.error(`Failed to fetch trench length by types: ${lengthByTypesResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [] };
		}

		if (!nodesByTypeResponse.ok) {
			console.error(`Failed to fetch nodes by type: ${nodesByTypeResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [] };
		}

		const [trenchData, lengthByTypesData, nodesByTypeData] = await Promise.all([
			trenchResponse.json(),
			lengthByTypesResponse.json(),
			nodesByTypeResponse.json()
		]);

		return {
			totalLength: trenchData.total_length,
			count: trenchData.count,
			lengthByTypes: lengthByTypesData.results.map((item) => ({
				bauweise: item.bauweise,
				oberfläche: item.oberfläche,
				gesamt_länge: item.gesamt_länge
			})),
			nodesByType: nodesByTypeData.results.map((item) => ({
				node_type: item.node_type,
				count: item.count
			}))
		};
	} catch (error) {
		console.error('Error fetching data:', error);
		return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [] };
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
