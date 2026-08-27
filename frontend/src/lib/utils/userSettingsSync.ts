import { browser } from '$app/environment';
import { invalidateAll } from '$app/navigation';
import { PUBLIC_API_URL } from '$env/static/public';

/**
 * localStorage keys that make up a user's portable settings snapshot.
 *
 * These are the client-side preferences worth carrying between browsers and
 * devices. Per-device state (last map center/zoom), transient session keys,
 * and runtime flags (e.g. tile-server availability) are intentionally omitted.
 *
 * Language (`PARAGLIDE_LOCALE`) is deliberately excluded: it is a raw string
 * managed by the Paraglide runtime and its own cookie, not a JSON-serialized
 * `persisted()` store, so it cannot be round-tripped through this snapshot.
 */
export const SYNCED_SETTINGS_KEYS = [
	'sidebarPreferences',
	'isSidebarExpanded',
	'trenchColor',
	'trenchColorSelected',
	'lightSwitchMode',
	'selectedFlag',
	'routingMode',
	'showLinkedTrenches',
	'showCableRoute',
	'routingTolerance',
	'theme',
	'drawerWidth',
	'drawerSnap',
	'edgeSnappingEnabled',
	'edgeSnappingGridSize',
	'globalMapView',
	'cableEdgeColorMode',
	'cableDirectionAnimationEnabled',
	'networkSchemaPanelExpanded',
	'networkSchemaDisplayOptionsExpanded',
	'nodeTypeStyles',
	'addressStyle',
	'trenchStyleMode',
	'trenchSurfaceStyles',
	'trenchConstructionTypeStyles',
	'labelVisibilityConfig',
	'areaTypeStyles',
	'layerVisibilityConfig',
	'layerOpacity',
	'basemapTheme',
	'wmsLayerVisibilityConfig',
	'wmsSourceExpansionState'
] as const;

/** A saved settings snapshot: a map of localStorage key to its parsed JSON value. */
export type SettingsSnapshot = Record<string, unknown>;

/**
 * Reads the synced localStorage keys and returns them as a JSON-serializable
 * snapshot. Keys absent from localStorage are skipped so defaults are not
 * baked into the saved payload.
 */
export function snapshotLocalSettings(storage: Storage): SettingsSnapshot {
	const snapshot: SettingsSnapshot = {};
	for (const key of SYNCED_SETTINGS_KEYS) {
		const raw = storage.getItem(key);
		if (raw === null) continue;
		try {
			snapshot[key] = JSON.parse(raw);
		} catch {
			// Skip malformed entries rather than saving unparseable strings.
		}
	}
	return snapshot;
}

/**
 * Writes a loaded snapshot back into localStorage. Only recognised synced keys
 * are applied; unknown keys in the payload are ignored so a stale or tampered
 * blob cannot pollute unrelated storage.
 *
 * @returns The number of keys that were applied.
 */
export function applySettingsSnapshot(storage: Storage, snapshot: SettingsSnapshot): number {
	let applied = 0;
	for (const key of SYNCED_SETTINGS_KEYS) {
		if (!(key in snapshot)) continue;
		storage.setItem(key, JSON.stringify(snapshot[key]));
		applied += 1;
	}
	return applied;
}

/** Performs a fetch against the user-settings endpoint, retrying once after a 401. */
async function fetchWithAuthRetry(input: string, init: RequestInit): Promise<Response> {
	const response = await fetch(input, { ...init, credentials: 'include' });
	if (response.status !== 401) return response;

	await invalidateAll();
	return fetch(input, { ...init, credentials: 'include' });
}

/**
 * Saves the current local settings snapshot to the server, overwriting any
 * previously saved settings for the user.
 *
 * @throws If not in the browser, or if the request fails.
 */
export async function saveUserSettings(): Promise<void> {
	if (!browser) throw new Error('saveUserSettings must run in the browser');

	const snapshot = snapshotLocalSettings(localStorage);
	const response = await fetchWithAuthRetry(`${PUBLIC_API_URL}user-settings/`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ settings: snapshot })
	});

	if (!response.ok) {
		throw new Error(`Failed to save settings: ${response.statusText}`);
	}
}

/**
 * Loads the saved settings from the server and applies them to localStorage.
 *
 * @returns The number of settings keys applied.
 * @throws If not in the browser, or if the request fails.
 */
export async function loadUserSettings(): Promise<number> {
	if (!browser) throw new Error('loadUserSettings must run in the browser');

	const response = await fetchWithAuthRetry(`${PUBLIC_API_URL}user-settings/`, { method: 'GET' });
	if (!response.ok) {
		throw new Error(`Failed to load settings: ${response.statusText}`);
	}

	const data = (await response.json()) as { settings?: SettingsSnapshot };
	return applySettingsSnapshot(localStorage, data.settings ?? {});
}
