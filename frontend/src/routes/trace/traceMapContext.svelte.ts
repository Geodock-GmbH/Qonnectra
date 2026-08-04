import type { TraceResult } from './traceUtils';
import { getContext, setContext } from 'svelte';

const TRACE_MAP_CONTEXT_KEY = Symbol('traceMapContext');

export interface TraceMapContext {
	traceResult: TraceResult | null;
	includeGeometry: boolean;
	selectedFeatureId: string | null;
	setSelectedFeature: (id: string | null) => void;
}

/**
 * Creates and sets the trace map context
 */
export function createTraceMapContext(): TraceMapContext {
	let traceResult: TraceResult | null = $state(null);
	let includeGeometry: boolean = $state(false);
	let selectedFeatureId: string | null = $state(null);

	const context: TraceMapContext = {
		get traceResult() {
			return traceResult;
		},
		set traceResult(value: TraceResult | null) {
			traceResult = value;
		},
		get includeGeometry() {
			return includeGeometry;
		},
		set includeGeometry(value: boolean) {
			includeGeometry = value;
		},
		get selectedFeatureId() {
			return selectedFeatureId;
		},
		setSelectedFeature(id: string | null) {
			selectedFeatureId = id;
		}
	};

	setContext(TRACE_MAP_CONTEXT_KEY, context);
	return context;
}

/**
 * Gets the trace map context
 */
export function getTraceMapContext(): TraceMapContext {
	return getContext<TraceMapContext>(TRACE_MAP_CONTEXT_KEY);
}
