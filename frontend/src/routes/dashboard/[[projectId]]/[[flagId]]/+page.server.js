import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

import { getDefaultDashboardData, mapStatsToDashboardData } from './dashboardUtils.js';

/**
 * Loads dashboard statistics and project list for the selected project.
 * Returns empty default values when no project is selected or on fetch failure.
 * @param {import('./$types').PageServerLoadEvent} event
 */
export async function load({ fetch, cookies, params }) {
	const { projectId } = params;
	const headers = getAuthHeaders(cookies);

	if (!projectId) {
		return getDefaultDashboardData();
	}

	try {
		const [statsResponse, projectsResponse] = await Promise.all([
			fetch(`${API_URL}dashboard/statistics/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}projects/`, {
				credentials: 'include',
				headers: headers
			})
		]);

		if (!statsResponse.ok) {
			console.error(`Failed to fetch dashboard statistics: ${statsResponse.status}`);
			return getDefaultDashboardData();
		}

		if (!projectsResponse.ok) {
			console.error(`Failed to fetch projects: ${projectsResponse.status}`);
			return getDefaultDashboardData();
		}

		const [statsData, projectsData] = await Promise.all([
			statsResponse.json(),
			projectsResponse.json()
		]);

		return mapStatsToDashboardData(statsData, projectsData);
	} catch (error) {
		console.error('Error fetching data:', error);
		return getDefaultDashboardData();
	}
}
