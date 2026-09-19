import type { ValuationArea, ValuationResult } from './valuation-data';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { countValuationRates, toValuationAreas, toValuationResult } from './valuation-data';

const ProjectIdSchema = v.pipe(v.string(), v.regex(/^\d+$/));

const AreaScopeSchema = v.object({
	projectId: v.optional(v.union([v.literal(''), ProjectIdSchema]), '')
});

const ProjectSchema = v.object({ projectId: ProjectIdSchema });

const CalculateValuationSchema = v.object({
	projectId: ProjectIdSchema,
	areaUuids: v.array(v.pipe(v.string(), v.uuid()))
});

/**
 * List the areas a valuation can be restricted to.
 * @param input.projectId - Project whose areas are listed; empty lists the areas of all projects.
 * @returns Every matching area with its type and geometry.
 * @throws When the backend request fails.
 */
export const getValuationAreas = query(
	AreaScopeSchema,
	async ({ projectId }): Promise<ValuationArea[]> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}area/all/`);
		if (projectId) url.searchParams.set('project', projectId);

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to load areas');

		return toValuationAreas(await response.json());
	}
);

/**
 * Count the valuation cost rates of a project, which are maintained in the
 * Django admin. A valuation without cost rates has nothing to multiply.
 * @param input.projectId - Project whose cost rates are counted.
 * @returns The number of cost rates.
 * @throws When the backend request fails.
 */
export const getValuationRateCount = query(
	ProjectSchema,
	async ({ projectId }): Promise<number> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}valuation-rates/`);
		url.searchParams.set('project', projectId);

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to load valuation cost rates');

		return countValuationRates(await response.json());
	}
);

/**
 * Calculate the valuation of a project. The backend computes this read-only,
 * so identical requests share one result.
 * @param input.projectId - Project to calculate for.
 * @param input.areaUuids - Areas to restrict the calculation to; empty covers the whole project.
 * @returns The priced cost rates, their total and the key figures.
 * @throws When the backend request fails.
 */
export const calculateValuation = query(
	CalculateValuationSchema,
	async ({ projectId, areaUuids }): Promise<ValuationResult> => {
		const response = await fetch(`${API_URL}valuation/calculate/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({ project: Number(projectId), area_uuids: areaUuids })
		});
		if (!response.ok) await failFromResponse(response, 'Failed to calculate valuation');

		return toValuationResult(await response.json());
	}
);
