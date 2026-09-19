import type { GeometryMode, TraceEntryType } from '$lib/remote/trace/trace-data';

import { traceEntryTypeFromSlug } from '$lib/utils/traceUtils';
import { GEOMETRY_MODES } from '$lib/remote/trace/trace-data';
import { getFiberTrace, getSignalAnalysis } from '$lib/remote/trace/trace.remote';

/** How a trace page is asked to trace, as carried by its query string. */
export interface TraceOptions {
	/** `signal` runs the signal analysis instead of the plain trace. */
	mode: 'trace' | 'signal';
	includeGeometry: boolean;
	geometryMode: GeometryMode;
	orientGeometry: boolean;
	/** Node the signal is fed in at; `null` uses the backend's default. */
	signalSource: string | null;
}

/**
 * Reads the trace options from a trace page's URL. Only a fiber can be
 * analysed for its signal, and the analysis always draws routed geometry.
 * @param entryType - Kind of entity the trace starts from.
 * @param url - The page URL.
 * @returns The options, with defaults for everything the URL leaves out.
 */
export function traceOptionsFromUrl(entryType: TraceEntryType, url: URL): TraceOptions {
	const params = url.searchParams;
	const orientGeometry = params.get('orient_geometry') === 'true';

	if (entryType === 'fiber' && params.get('mode') === 'signal') {
		return {
			mode: 'signal',
			includeGeometry: true,
			geometryMode: 'routed',
			orientGeometry,
			signalSource: params.get('source') || null
		};
	}

	const geometryMode = GEOMETRY_MODES.find((mode) => mode === params.get('geometry_mode'));
	return {
		mode: 'trace',
		includeGeometry: params.get('include_geometry') === 'true',
		geometryMode: geometryMode ?? 'segments',
		orientGeometry,
		signalSource: null
	};
}

/** The trace a result page shows, as addressed by its URL. */
export interface TraceRequest {
	entryType: TraceEntryType;
	entryId: string;
	options: TraceOptions;
}

/**
 * Reads the requested trace from a trace page's route params and URL.
 * @param params - The route params (`entryType` slug and `uuid`).
 * @param url - The page URL.
 * @returns The request, or `null` on a page that addresses no entity.
 */
export function traceRequestFromPage(
	params: Record<string, string | undefined>,
	url: URL
): TraceRequest | null {
	const entryType = traceEntryTypeFromSlug(params.entryType ?? '');
	if (!entryType || !params.uuid) return null;
	return { entryType, entryId: params.uuid, options: traceOptionsFromUrl(entryType, url) };
}

/**
 * Picks the query a trace page renders. The result panel and the map both
 * call it with the same request, so they share one backend call.
 * @param request - The requested trace.
 * @returns The signal analysis in signal mode, otherwise the fiber trace.
 */
export function traceQuery({ entryType, entryId, options }: TraceRequest) {
	if (options.mode === 'signal') {
		return getSignalAnalysis({
			fiberId: entryId,
			signalSource: options.signalSource,
			orientGeometry: options.orientGeometry
		});
	}
	return getFiberTrace({
		entryType,
		entryId,
		includeGeometry: options.includeGeometry,
		geometryMode: options.geometryMode,
		orientGeometry: options.orientGeometry
	});
}
