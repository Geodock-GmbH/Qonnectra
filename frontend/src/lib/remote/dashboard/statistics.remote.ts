import type { DashboardData, DashboardStatisticsResponse } from './dashboard-data';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { getDefaultDashboardData, mapStatsToDashboardData } from './dashboard-data';

const DashboardStatisticsSchema = v.object({
	projectId: v.string()
});

/**
 * Fetch the statistics every dashboard tab renders. The backend serves them
 * from one consolidated, cached endpoint, so all tabs share this query.
 * @param input.projectId - Project to scope the statistics to; empty when none is selected.
 * @returns Flat dashboard data; all-zero defaults without a project.
 * @throws When the backend request fails.
 */
export const getDashboardStatistics = query(
	DashboardStatisticsSchema,
	async ({ projectId }): Promise<DashboardData> => {
		if (!projectId) return getDefaultDashboardData();
		const headers = djangoHeaders();

		const url = new URL(`${API_URL}dashboard/statistics/`);
		url.searchParams.set('project', projectId);

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to fetch dashboard statistics');

		return mapStatsToDashboardData((await response.json()) as DashboardStatisticsResponse);
	}
);
