import type { AddressSearchResult } from './address-search-data';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { mapAddressSearchResults } from './address-search-data';

const AddressSearchSchema = v.object({
	searchQuery: v.pipe(v.string(), v.trim(), v.minLength(2)),
	projectId: v.optional(v.string(), '')
});

/**
 * Fuzzy-search the addresses of a project for the post-compaction picker.
 * @param input.searchQuery - The search term (at least 2 characters).
 * @param input.projectId - Project to scope the search to; empty searches all projects.
 * @returns Up to 20 matching addresses.
 * @throws When the backend request fails.
 */
export const searchAddresses = query(
	AddressSearchSchema,
	async ({ searchQuery, projectId }): Promise<AddressSearchResult[]> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}trace-search/`);
		url.searchParams.set('search', searchQuery);
		url.searchParams.set('type', 'address');
		if (projectId) url.searchParams.set('project', projectId);

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to search addresses');

		return mapAddressSearchResults(await response.json());
	}
);
