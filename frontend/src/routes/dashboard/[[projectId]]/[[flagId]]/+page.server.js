import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies, params }) {
	const { projectId } = params;
	const headers = getAuthHeaders(cookies);

	if (!projectId) {
		return {
			totalLength: 0,
			count: 0,
			lengthByTypes: [],
			avgHouseConnectionLength: 0,
			lengthWithFunding: 0,
			lengthWithInternalExecution: 0,
			lengthByStatus: [],
			lengthByNetworkLevel: [],
			longestRoutes: []
		};
	}

	try {
		const [
			trenchResponse,
			lengthByTypesResponse,
			nodesByTypeResponse,
			projectsResponse,
			avgHouseConnectionResponse,
			lengthWithFundingResponse,
			lengthWithInternalExecutionResponse,
			lengthByStatusResponse,
			lengthByNetworkLevelResponse,
			longestRoutesResponse
		] = await Promise.all([
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
			}),
			fetch(`${API_URL}trench/average_house_connection_length/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}trench/length_with_funding/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}trench/length_with_internal_execution/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}trench/length_by_status/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}trench/length_by_phase/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}trench/longest_routes/?project=${projectId}&limit=5`, {
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

		if (!avgHouseConnectionResponse.ok) {
			console.error(
				`Failed to fetch average house connection length: ${avgHouseConnectionResponse.status}`
			);
		}

		if (!lengthWithFundingResponse.ok) {
			console.error(`Failed to fetch length with funding: ${lengthWithFundingResponse.status}`);
		}

		if (!lengthWithInternalExecutionResponse.ok) {
			console.error(
				`Failed to fetch length with internal execution: ${lengthWithInternalExecutionResponse.status}`
			);
		}

		if (!lengthByStatusResponse.ok) {
			console.error(`Failed to fetch length by status: ${lengthByStatusResponse.status}`);
		}

		if (!lengthByNetworkLevelResponse.ok) {
			console.error(
				`Failed to fetch length by network level: ${lengthByNetworkLevelResponse.status}`
			);
		}

		if (!longestRoutesResponse.ok) {
			console.error(`Failed to fetch longest routes: ${longestRoutesResponse.status}`);
		}

		const [
			trenchData,
			lengthByTypesData,
			nodesByTypeData,
			projectsData,
			avgHouseConnectionData,
			lengthWithFundingData,
			lengthWithInternalExecutionData,
			lengthByStatusData,
			lengthByNetworkLevelData,
			longestRoutesData
		] = await Promise.all([
			trenchResponse.json(),
			lengthByTypesResponse.json(),
			nodesByTypeResponse.json(),
			projectsResponse.json(),
			avgHouseConnectionResponse.ok ? avgHouseConnectionResponse.json() : { average_length: 0 },
			lengthWithFundingResponse.ok ? lengthWithFundingResponse.json() : { total_length: 0 },
			lengthWithInternalExecutionResponse.ok
				? lengthWithInternalExecutionResponse.json()
				: { total_length: 0 },
			lengthByStatusResponse.ok ? lengthByStatusResponse.json() : { results: [] },
			lengthByNetworkLevelResponse.ok
				? lengthByNetworkLevelResponse.json()
				: { results: [] },
			longestRoutesResponse.ok ? longestRoutesResponse.json() : { results: [] }
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
			})),
			avgHouseConnectionLength: avgHouseConnectionData.average_length || 0,
			lengthWithFunding: lengthWithFundingData.total_length || 0,
			lengthWithInternalExecution: lengthWithInternalExecutionData.total_length || 0,
			lengthByStatus: lengthByStatusData.results || [],
			lengthByNetworkLevel: lengthByNetworkLevelData.results || [],
			longestRoutes: longestRoutesData.results || []
		};
	} catch (error) {
		console.error('Error fetching data:', error);
		return {
			totalLength: 0,
			count: 0,
			lengthByTypes: [],
			nodesByType: [],
			avgHouseConnectionLength: 0,
			lengthWithFunding: 0,
			lengthWithInternalExecution: 0,
			lengthByStatus: [],
			lengthByNetworkLevel: [],
			longestRoutes: []
		};
	}
}
