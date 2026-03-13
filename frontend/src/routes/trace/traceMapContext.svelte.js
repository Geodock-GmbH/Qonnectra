import { getContext, setContext } from 'svelte';

const TRACE_MAP_CONTEXT_KEY = Symbol('traceMapContext');

/**
 * @typedef {Object} TraceMapContext
 * @property {Record<string, any>|null} traceResult - The trace result data
 * @property {boolean} includeGeometry - Whether geometry was requested
 * @property {string|null} selectedFeatureId - Currently selected feature ID
 * @property {(id: string|null) => void} setSelectedFeature - Function to select a feature
 */

/**
 * Creates and sets the trace map context
 * @returns {TraceMapContext}
 */
export function createTraceMapContext() {
	let traceResult = $state(null);
	let includeGeometry = $state(false);
	/** @type {string|null} */
	let selectedFeatureId = $state(null);

	const context = {
		get traceResult() {
			return traceResult;
		},
		set traceResult(value) {
			traceResult = value;
		},
		get includeGeometry() {
			return includeGeometry;
		},
		set includeGeometry(value) {
			includeGeometry = value;
		},
		get selectedFeatureId() {
			return selectedFeatureId;
		},
		/** @param {string|null} id */
		setSelectedFeature(id) {
			selectedFeatureId = id;
		}
	};

	setContext(TRACE_MAP_CONTEXT_KEY, context);
	return context;
}

/**
 * Gets the trace map context
 * @returns {TraceMapContext}
 */
export function getTraceMapContext() {
	return getContext(TRACE_MAP_CONTEXT_KEY);
}
