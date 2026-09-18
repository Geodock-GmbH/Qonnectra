import type { Schemas } from '$lib/types';
import { error } from '@sveltejs/kit';
import { getRequestEvent, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { logFiltersToSearchParams } from './logs-data';

const LogFiltersSchema = v.object({
	level: v.string(),
	source: v.string(),
	search: v.string(),
	dateFrom: v.string(),
	dateTo: v.string(),
	project: v.string(),
	page: v.pipe(v.number(), v.integer(), v.minValue(1))
});

/**
 * Fetch one page of application logs matching the filters. Admin only.
 * @param filters - Level, source, search, date range, project and page.
 * @throws 403 for non-admin users, or when the backend request fails.
 */
export const getLogs = query(
	LogFiltersSchema,
	async (filters): Promise<Schemas['PaginatedLogEntryList']> => {
		const { locals } = getRequestEvent();
		if (!locals.user?.isAdmin) error(403, 'Admin access required');
		const headers = djangoHeaders();

		const response = await fetch(`${API_URL}logs/?${logFiltersToSearchParams(filters)}`, {
			headers
		});
		if (!response.ok) await failFromResponse(response, 'Failed to fetch logs');

		return (await response.json()) as Schemas['PaginatedLogEntryList'];
	}
);
