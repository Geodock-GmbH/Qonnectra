import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import {
	backendErrorMessage,
	errorStatus,
	failFromResponse
} from '$lib/remote/shared/backend-error';

import { property } from './json';

/** What a route is calculated from. */
export interface RouteInput {
	/** `id_trench` of the first trench. */
	startTrenchId: string;
	/** `id_trench` of the last trench. */
	endTrenchId: string;
	projectId: string;
	/** Snapping tolerance in metres. */
	tolerance: number;
}

/** A trench the route runs through. */
export interface RoutedTrench {
	uuid: string;
	/** The trench's `id_trench`. */
	label: string;
}

/** The shortest path between two trenches. */
export interface RouteResult {
	/** Merged path geometry as WKT in the storage projection. */
	pathWkt: string;
	trenches: RoutedTrench[];
}

/** A trench reduced to its GeoJSON geometry, in the storage projection. */
export interface TrenchFeature {
	type: 'Feature';
	geometry: { type: string; coordinates: unknown };
	[key: string]: unknown;
}

/**
 * Builds the body of a routing request. The routing view reads the first
 * element of `project_id` and `tolerance`, so both travel as arrays.
 * @param input - Start/end trench, project and tolerance.
 * @returns The JSON body for `routing/`.
 */
export function buildRoutingBody(input: RouteInput): Record<string, unknown> {
	return {
		start_trench_id: input.startTrenchId,
		end_trench_id: input.endTrenchId,
		project_id: [Number.parseInt(input.projectId, 10)],
		tolerance: [input.tolerance]
	};
}

/**
 * Builds a user-facing message from a routing error body. The routing view
 * reports failures under `error` instead of DRF's `detail`.
 * @param errorData - Parsed JSON error body (may be anything).
 * @param fallback - Message when the body names no reason.
 * @returns A user-facing error message.
 */
export function routingErrorMessage(errorData: unknown, fallback: string): string {
	const reason = property(errorData, 'error');
	if (typeof reason === 'string' && reason) return reason;
	return backendErrorMessage(errorData, fallback);
}

/**
 * Maps the routing view's result to the route the page draws.
 * @param data - Body of a successful `routing/` response.
 * @returns The route, or `null` when it carries no geometry or no trenches.
 */
export function mapRouteResult(data: unknown): RouteResult | null {
	const pathWkt = property(data, 'path_geometry_wkt');
	const uuids = property(data, 'traversed_trench_uuids');
	if (typeof pathWkt !== 'string' || !pathWkt) return null;
	if (!Array.isArray(uuids) || uuids.length === 0) return null;

	const ids = property(data, 'traversed_trench_ids');
	const labels: unknown[] = Array.isArray(ids) ? ids : [];

	return {
		pathWkt,
		trenches: uuids.map((uuid: unknown, index) => ({
			uuid: String(uuid),
			label: labels[index] == null ? '' : String(labels[index])
		}))
	};
}

/**
 * Asks the backend for the shortest path between two trenches.
 * @param headers - Django auth headers including the JSON content type.
 * @param input - Start/end trench, project and tolerance.
 * @returns The route.
 * @throws When no route exists or the backend request fails.
 */
export async function requestRoute(
	headers: Record<string, string>,
	input: RouteInput
): Promise<RouteResult> {
	const response = await fetch(`${API_URL}routing/`, {
		method: 'POST',
		headers,
		body: JSON.stringify(buildRoutingBody(input))
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		error(errorStatus(response), routingErrorMessage(errorData, 'Routing failed'));
	}

	const route = mapRouteResult(await response.json());
	if (!route) error(404, 'No route found');
	return route;
}

/**
 * Picks the first trench of a (possibly paginated) GeoJSON feature collection
 * and strips it down to its geometry.
 * @param data - Body of a `trench/` list response.
 * @returns The trench as a geometry-only feature, or `null` when none matched.
 */
export function pickTrenchFeature(data: unknown): TrenchFeature | null {
	const collection = property(data, 'results') ?? data;
	const features = property(collection, 'features');
	if (!Array.isArray(features)) return null;

	const geometry: unknown = property(features[0], 'geometry');
	const type = property(geometry, 'type');
	if (typeof type !== 'string') return null;

	return { type: 'Feature', geometry: { type, coordinates: property(geometry, 'coordinates') } };
}

/**
 * Fetches the geometry of a trench.
 * @param headers - Django auth headers.
 * @param trenchUuid - UUID of the trench.
 * @returns The trench as a geometry-only GeoJSON feature.
 * @throws When the trench does not exist or the backend request fails.
 */
export async function fetchTrenchFeature(
	headers: Record<string, string>,
	trenchUuid: string
): Promise<TrenchFeature> {
	const response = await fetch(`${API_URL}trench/?uuid=${encodeURIComponent(trenchUuid)}`, {
		headers
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch trench');

	const feature = pickTrenchFeature(await response.json());
	if (!feature) error(404, 'Trench not found');
	return feature;
}
