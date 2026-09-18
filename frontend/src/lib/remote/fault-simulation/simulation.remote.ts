import type { FaultSimulationResult } from './simulation-data';
import { error } from '@sveltejs/kit';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { errorStatus } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { simulationErrorMessage } from './simulation-data';

const SimulateFaultSchema = v.object({
	point: v.tuple([v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite())]),
	projectId: v.pipe(v.string(), v.nonEmpty())
});

/**
 * Simulate damage at a point and report the infrastructure that would fail.
 * The backend computes this read-only, so identical requests share one result.
 * @param input.point - Damage location as `[x, y]` in the storage projection.
 * @param input.projectId - Project to search for the damaged trench.
 * @returns The affected trench, conduits, cables, addresses and their geometries.
 * @throws With 404 when no trench lies near the point, or when the backend request fails.
 */
export const simulateFault = query(
	SimulateFaultSchema,
	async ({ point, projectId }): Promise<FaultSimulationResult> => {
		const response = await fetch(`${API_URL}fault-simulation/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({ point, project_id: projectId })
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			error(errorStatus(response), simulationErrorMessage(errorData, 'Simulation failed'));
		}

		return (await response.json()) as FaultSimulationResult;
	}
);
