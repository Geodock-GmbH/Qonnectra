import type { TraceSearchResult } from '$lib/types/trace';

import { property } from '$lib/remote/shared/json';

/** Entities a fiber trace can start from. */
export const TRACE_ENTRY_TYPES = ['address', 'node', 'cable', 'residential_unit', 'fiber'] as const;

export type TraceEntryType = (typeof TRACE_ENTRY_TYPES)[number];

/** Entities the trace search can look up; fibers are picked through their cable. */
export const TRACE_SEARCH_TYPES = ['address', 'node', 'cable', 'residential_unit'] as const;

export type TraceSearchType = (typeof TRACE_SEARCH_TYPES)[number];

/** How the backend shapes the trench geometry of a trace. */
export const GEOMETRY_MODES = ['segments', 'merged', 'routed'] as const;

export type GeometryMode = (typeof GEOMETRY_MODES)[number];

/** What a fiber trace is calculated from. */
export interface FiberTraceInput {
	entryType: TraceEntryType;
	entryId: string;
	includeGeometry: boolean;
	geometryMode: GeometryMode;
	orientGeometry: boolean;
}

/** What a signal analysis is calculated from. */
export interface SignalAnalysisInput {
	fiberId: string;
	/** Node the signal is fed in at; `null` lets the backend pick its default. */
	signalSource: string | null;
	orientGeometry: boolean;
}

/** What the trace search looks for. */
export interface TraceSearchInput {
	searchQuery: string;
	type: TraceSearchType;
	/** Project to scope the search to; empty searches all projects. */
	projectId: string;
}

/**
 * Builds the `fiber-trace/` request path. The geometry mode and orientation
 * only travel when geometry is included.
 * @param input - Entry entity and geometry options.
 * @returns The path relative to the API root.
 */
export function fiberTracePath(input: FiberTraceInput): string {
	const params = new URLSearchParams({
		[`${input.entryType}_id`]: input.entryId,
		include_geometry: String(input.includeGeometry)
	});
	if (input.includeGeometry) {
		params.set('geometry_mode', input.geometryMode);
		params.set('orient_geometry', String(input.orientGeometry));
	}
	return `fiber-trace/?${params}`;
}

/**
 * Builds the `signal-analysis/` request path. The analysis is drawn on the
 * map, so it always asks for routed geometry.
 * @param input - Fiber, signal source and orientation.
 * @returns The path relative to the API root.
 */
export function signalAnalysisPath(input: SignalAnalysisInput): string {
	const params = new URLSearchParams({ fiber_id: input.fiberId, include_geometry: 'true' });
	if (input.signalSource) params.set('signal_source_node_id', input.signalSource);
	params.set('geometry_mode', 'routed');
	params.set('orient_geometry', String(input.orientGeometry));
	return `signal-analysis/?${params}`;
}

/**
 * Builds the `trace-search/` request path.
 * @param input - Search term, entity type and project scope.
 * @returns The path relative to the API root.
 */
export function traceSearchPath(input: TraceSearchInput): string {
	const params = new URLSearchParams({ search: input.searchQuery, type: input.type });
	if (input.projectId) params.set('project', input.projectId);
	return `trace-search/?${params}`;
}

/**
 * Maps the `trace-search/` payload to search hits, dropping hits without a
 * uuid since they cannot be selected.
 * @param payload - The raw response body.
 * @returns The selectable hits, or an empty array when none.
 */
export function mapTraceSearchResults(payload: unknown): TraceSearchResult[] {
	const results = property(payload, 'results');
	if (!Array.isArray(results)) return [];
	return (results as TraceSearchResult[]).filter((result) => result.uuid);
}
