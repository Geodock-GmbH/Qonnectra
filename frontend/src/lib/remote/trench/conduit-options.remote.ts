import type { ConduitOption } from './conduit-options';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { mapConduitOptions } from './conduit-options';

const ConduitOptionsSchema = v.object({
	projectId: v.pipe(v.string(), v.nonEmpty()),
	flagId: v.pipe(v.string(), v.nonEmpty())
});

/**
 * Fetch every conduit of a project and flag as picker options.
 * @param input.projectId - Project the conduits belong to.
 * @param input.flagId - Flag the conduits carry.
 * @returns The conduits as `name (type)` options.
 * @throws When the backend request fails.
 */
export const getConduitOptions = query(
	ConduitOptionsSchema,
	async ({ projectId, flagId }): Promise<ConduitOption[]> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}conduit/all/`);
		url.searchParams.set('project', projectId);
		url.searchParams.set('flag', flagId);
		url.searchParams.set('no_pagination', 'true');

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to fetch conduits');

		return mapConduitOptions(await response.json());
	}
);
