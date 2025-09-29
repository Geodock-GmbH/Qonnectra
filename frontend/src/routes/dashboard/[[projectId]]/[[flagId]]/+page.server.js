import { API_URL } from '$env/static/private';
import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies, params }) {
	const { projectId } = params;
	const headers = getAuthHeaders(cookies);

	if (!projectId) {
		return { totalLength: 0, count: 0, lengthByTypes: [] };
	}

	try {
		const [trenchResponse, lengthByTypesResponse, nodesByTypeResponse, projectsResponse] =
			await Promise.all([
				fetch(`${API_URL}trench/total_length/?project=${projectId}`, {
					credentials: 'include',
					headers: headers
				}),
				fetch(`${API_URL}trench/length_by_types/?project=${projectId}`, {
					credentials: 'include',
					headers: headers
				}),
				fetch(`${API_URL}node/count_of_nodes_by_type/?project=${projectId}`, {
					credentials: 'include',
					headers: headers
				}),
				fetch(`${API_URL}projects/`, {
					credentials: 'include',
					headers: headers
				})
			]);

		if (!trenchResponse.ok) {
			console.error(`Failed to fetch trenches: ${trenchResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [], projects: [] };
		}

		if (!lengthByTypesResponse.ok) {
			console.error(`Failed to fetch trench length by types: ${lengthByTypesResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [], projects: [] };
		}

		if (!nodesByTypeResponse.ok) {
			console.error(`Failed to fetch nodes by type: ${nodesByTypeResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [], projects: [] };
		}

		if (!projectsResponse.ok) {
			console.error(`Failed to fetch projects: ${projectsResponse.status}`);
			return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [], projects: [] };
		}

		const [trenchData, lengthByTypesData, nodesByTypeData, projectsData] = await Promise.all([
			trenchResponse.json(),
			lengthByTypesResponse.json(),
			nodesByTypeResponse.json(),
			projectsResponse.json()
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
			})),
			projects: projectsData.map((item) => ({
				project: item.project,
				description: item.description,
				active: item.active
			}))
		};
	} catch (error) {
		console.error('Error fetching data:', error);
		return { totalLength: 0, count: 0, lengthByTypes: [], nodesByType: [] };
	}
}
