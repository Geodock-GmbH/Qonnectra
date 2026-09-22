import type { MapView } from './viewHash';
import { browser } from '$app/environment';

/**
 * The last map view per project, remembered in this browser so the next
 * visit to a project opens where the user left it instead of on another
 * project's extent. A fallback for the URL hash, which wins when present.
 */

/**
 * The localStorage key of a project's remembered view.
 * @param projectId - The project id.
 */
function storageKey(projectId: string): string {
	return `mapView:${projectId}`;
}

/**
 * Reads the remembered view of a project.
 * @param projectId - The project id; empty reads nothing.
 * @returns The view, or null when none is remembered or the entry is unreadable.
 */
export function readStoredView(projectId: string): MapView | null {
	if (!browser || !projectId) return null;
	try {
		const raw = localStorage.getItem(storageKey(projectId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<MapView> | null;
		const center = parsed?.center;
		if (
			typeof parsed?.zoom !== 'number' ||
			!Array.isArray(center) ||
			center.length !== 2 ||
			!center.every((value) => typeof value === 'number' && Number.isFinite(value))
		) {
			return null;
		}
		return { zoom: parsed.zoom, center: [center[0], center[1]] };
	} catch {
		return null;
	}
}

/**
 * Remembers the view of a project.
 * @param projectId - The project id; empty writes nothing.
 * @param view - The view to remember.
 */
export function writeStoredView(projectId: string, view: MapView): void {
	if (!browser || !projectId) return;
	try {
		localStorage.setItem(storageKey(projectId), JSON.stringify(view));
	} catch {
		// Storage can be full or blocked; the URL hash still carries the view.
	}
}

/**
 * The view a map opens on: the URL hash when the map keeps its view there,
 * else the project's remembered view. Null means the caller falls back to
 * the project extent, then to the defaults.
 * @param options - The hash and project to consult.
 * @returns The initial view, or null when neither source has one.
 */
export function resolveInitialView({
	hashView,
	projectId
}: {
	hashView: MapView | null;
	projectId: string;
}): MapView | null {
	return hashView ?? readStoredView(projectId);
}
