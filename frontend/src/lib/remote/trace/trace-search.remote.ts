import type { TraceSearchResult } from '$lib/types/trace';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { mapTraceSearchResults, TRACE_SEARCH_TYPES, traceSearchPath } from './trace-data';

const TraceSearchSchema = v.object({
	searchQuery: v.pipe(v.string(), v.trim(), v.minLength(2)),
	type: v.picklist(TRACE_SEARCH_TYPES),
	projectId: v.optional(v.string(), '')
});

/**
 * Search the entities a trace can start from.
 * @param input.searchQuery - The search term (at least 2 characters).
 * @param input.type - Kind of entity to search.
 * @param input.projectId - Project to scope the search to; empty searches all projects.
 * @returns Up to 20 matching entities; the fields depend on the entity type.
 * @throws When the backend request fails.
 */
export const searchTraceEntries = query(
	TraceSearchSchema,
	async (input): Promise<TraceSearchResult[]> => {
		const response = await fetch(`${API_URL}${traceSearchPath(input)}`, {
			headers: djangoHeaders()
		});
		if (!response.ok) await failFromResponse(response, 'Search failed');

		return mapTraceSearchResults(await response.json());
	}
);
