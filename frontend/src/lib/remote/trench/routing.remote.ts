import type { RouteResult, TrenchFeature } from './routing-data';
import { query } from '$app/server';
import * as v from 'valibot';

import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { fetchTrenchFeature, requestRoute } from './routing-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const RouteSchema = v.object({
	startTrenchId: v.pipe(v.string(), v.nonEmpty()),
	endTrenchId: v.pipe(v.string(), v.nonEmpty()),
	projectId: v.pipe(v.string(), v.nonEmpty()),
	tolerance: v.pipe(v.number(), v.minValue(0))
});

/**
 * Calculate the shortest path between two trenches. Read-only: the backend
 * computes the route and stores nothing.
 * @param input.startTrenchId - `id_trench` of the first trench.
 * @param input.endTrenchId - `id_trench` of the last trench.
 * @param input.projectId - Project whose trench network is searched.
 * @param input.tolerance - Snapping tolerance in metres.
 * @returns The path geometry and the trenches it runs through.
 * @throws When no route exists or the backend request fails.
 */
export const calculateRoute = query(
	RouteSchema,
	async (input): Promise<RouteResult> => requestRoute(djangoHeaders(true), input)
);

/**
 * Fetch the geometry of a trench, for zooming the map to it.
 * @param trenchUuid - Trench UUID.
 * @returns The trench as a geometry-only GeoJSON feature in the storage projection.
 * @throws When the trench does not exist or the backend request fails.
 */
export const getTrenchGeometry = query(
	UuidSchema,
	async (trenchUuid): Promise<TrenchFeature> => fetchTrenchFeature(djangoHeaders(), trenchUuid)
);
