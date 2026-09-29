import type { GeometryMode, TraceEntryType, TraceSearchType } from '$lib/remote/trace/trace-data';
import type { TraceEntryPath } from '$lib/utils/traceUtils';
import { createContext } from 'svelte';
import { page } from '$app/state';

import { traceEntryPath, traceEntrySlug, traceEntryTypeFromSlug } from '$lib/utils/traceUtils';
import { queryEnum, queryString, setQuery } from '$lib/utils/urlState';
import { GEOMETRY_MODES } from '$lib/remote/trace/trace-data';

/** A picked cable is addressed by its uuid; anything else counts as none. */
const CABLE_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * What the trace search landing is set to, read from its URL: the kind of
 * entity to trace (`type`), the search scope (`global`), the geometry
 * options a started trace carries (`include_geometry`, `geometry_mode`,
 * `orient_geometry`, spelled as the result page reads them) and the cable
 * whose fibers are being picked (`cable`). Back from a result therefore
 * returns to the same search. Only the typed search text stays local.
 */
export class TraceSearchState {
	/** Entity kind the search offers; `address` when the URL names none or an unknown one. */
	get activeType(): TraceEntryType {
		return traceEntryTypeFromSlug(queryString(page.url, 'type')) ?? 'address';
	}

	/** Search every project instead of the remembered one. */
	get globalSearch(): boolean {
		return page.url.searchParams.get('global') === 'true';
	}

	get includeGeometry(): boolean {
		return page.url.searchParams.get('include_geometry') === 'true';
	}

	get geometryMode(): GeometryMode {
		return queryEnum(page.url, 'geometry_mode', GEOMETRY_MODES, 'segments');
	}

	get orientGeometry(): boolean {
		return page.url.searchParams.get('orient_geometry') === 'true';
	}

	/** Cable picked on the fiber tab, whose fibers are offered for tracing; `null` off that tab. */
	get selectedCableUuid(): string | null {
		if (this.activeType !== 'fiber') return null;
		const raw = queryString(page.url, 'cable');
		return CABLE_ID.test(raw) ? raw : null;
	}

	/** Entity kind the search looks up; a fiber is found through its cable. */
	get searchType(): TraceSearchType {
		return this.activeType === 'fiber' ? 'cable' : this.activeType;
	}

	/**
	 * Switches the kind of entity to trace and drops the picked cable. An
	 * adjustment of the same page, so the history entry is rewritten.
	 * @param type - The entry type to switch to.
	 * @returns Resolves once the navigation has completed.
	 */
	setActiveType(type: TraceEntryType) {
		return setQuery({ type: type === 'address' ? null : traceEntrySlug(type), cable: null });
	}

	/**
	 * @param on - Whether to search every project.
	 * @returns Resolves once the navigation has completed.
	 */
	setGlobalSearch(on: boolean) {
		return setQuery({ global: on ? 'true' : null });
	}

	/**
	 * @param on - Whether a started trace asks for geometry.
	 * @returns Resolves once the navigation has completed.
	 */
	setIncludeGeometry(on: boolean) {
		return setQuery({ include_geometry: on ? 'true' : null });
	}

	/**
	 * @param mode - How the trench geometry of a started trace is shaped.
	 * @returns Resolves once the navigation has completed.
	 */
	setGeometryMode(mode: GeometryMode) {
		return setQuery({ geometry_mode: mode === 'segments' ? null : mode });
	}

	/**
	 * @param on - Whether a started trace orients its geometry.
	 * @returns Resolves once the navigation has completed.
	 */
	setOrientGeometry(on: boolean) {
		return setQuery({ orient_geometry: on ? 'true' : null });
	}

	/**
	 * Picks the cable whose fibers are offered next. Step one of a fiber
	 * search is a place, so back returns to the cable search.
	 * @param uuid - The cable's uuid.
	 * @returns Resolves once the navigation has completed.
	 */
	pickCable(uuid: string) {
		return setQuery({ cable: uuid }, { push: true });
	}

	/**
	 * Returns to the cable search by rewriting the current entry, so back
	 * never re-picks the cable.
	 * @returns Resolves once the navigation has completed.
	 */
	clearCable() {
		return setQuery({ cable: null });
	}

	/**
	 * Builds the path of an entity's trace page, carrying the geometry
	 * options unchanged.
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
