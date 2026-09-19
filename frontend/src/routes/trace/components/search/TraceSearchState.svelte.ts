import type { GeometryMode, TraceEntryType, TraceSearchType } from '$lib/remote/trace/trace-data';
import type { TraceCable } from '$lib/types/trace';
import type { TraceEntryPath } from '$lib/utils/traceUtils';
import { createContext } from 'svelte';

import { traceEntryPath } from '$lib/utils/traceUtils';

/**
 * What the trace search page is set to: the kind of entity to trace, the
 * search scope, the geometry options a started trace carries, and the cable
 * whose fibers are being picked.
 */
export class TraceSearchState {
	activeType = $state<TraceEntryType>('address');
	/** Search every project instead of the selected one. */
	globalSearch = $state(false);
	includeGeometry = $state(false);
	geometryMode = $state<GeometryMode>('segments');
	orientGeometry = $state(false);
	/** Cable picked on the fiber tab; its fibers are offered for tracing. */
	selectedCable = $state<TraceCable | null>(null);

	/** Entity kind the search looks up; a fiber is found through its cable. */
	get searchType(): TraceSearchType {
		return this.activeType === 'fiber' ? 'cable' : this.activeType;
	}

	/**
	 * Switches the kind of entity to trace and drops the picked cable.
	 * @param type - The entry type to switch to.
	 */
	setActiveType(type: TraceEntryType): void {
		this.activeType = type;
		this.selectedCable = null;
	}

	/**
	 * Builds the path of an entity's trace page, carrying the geometry options.
	 * @param type - Kind of entity the trace starts from.
	 * @param uuid - Entity UUID.
	 * @returns The app-relative path including its query string.
	 */
	tracePath(type: TraceEntryType, uuid: string): TraceEntryPath | `${TraceEntryPath}?${string}` {
		const path = traceEntryPath(type, uuid);
		if (!this.includeGeometry) return path;

		const params = new URLSearchParams({
			include_geometry: 'true',
			geometry_mode: this.geometryMode
		});
		if (this.orientGeometry) params.set('orient_geometry', 'true');
		return `${path}?${params}`;
	}
}

export const [getTraceSearchState, setTraceSearchState] = createContext<TraceSearchState>();
