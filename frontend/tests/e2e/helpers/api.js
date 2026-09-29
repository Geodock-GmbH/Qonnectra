import { API_URL } from './auth.js';

/**
 * A feature the backend lists: its uuid, the label the drawer titles it with,
 * and the first vertex of its geometry in the storage projection.
 * @typedef {{ uuid: string, label: string, firstCoordinate: number[] | null }} ListedFeature
 */

/**
 * Reads the first feature of a kind in a project straight from the API,
 * with the browser context's auth cookies, so a spec can build a deep link
 * to a real entity.
 * @param {import('@playwright/test').Page} page - A logged-in page.
 * @param {'trench' | 'node' | 'address' | 'area'} kind - The feature kind, as in the API path.
 * @param {string} projectId - The project to look in.
 * @returns {Promise<ListedFeature | null>} The feature, or null when the project has none.
 */
export async function firstFeature(page, kind, projectId) {
	const response = await page.request.get(`${API_URL}${kind}/?project=${projectId}`);
	if (!response.ok()) return null;
	const payload = await response.json();
	const features = Array.isArray(payload)
		? payload
		: (payload?.results?.features ?? payload?.features ?? payload?.results ?? []);
	const first = features[0];
	if (!first) return null;
	const props = first.properties ?? first;
	const uuid = first.id ?? props.uuid;
	if (!uuid) return null;
	return {
		uuid: String(uuid),
		label: String(props.id_trench ?? props.name ?? ''),
		firstCoordinate: firstVertex(first.geometry)
	};
}

/**
 * The first vertex of a GeoJSON geometry, whatever its nesting.
 * @param {unknown} geometry - A GeoJSON geometry, or anything else.
 * @returns {number[] | null} `[x, y]`, or null when there is no vertex.
 */
function firstVertex(geometry) {
	let coordinates = /** @type {any} */ (geometry)?.coordinates;
	while (Array.isArray(coordinates) && Array.isArray(coordinates[0])) coordinates = coordinates[0];
	return Array.isArray(coordinates) && coordinates.length >= 2 ? coordinates.slice(0, 2) : null;
}

/**
 * A cable the fiber search can pick: its uuid and the name the search finds it by.
 * @typedef {{ uuid: string, name: string }} ListedCable
 */

/**
 * Finds a cable of the project that has fibers, straight from the API, so a
 * spec can pick fibers through it. Only the first few cables are checked.
 * @param {import('@playwright/test').Page} page - A logged-in page.
 * @param {string} projectId - The project to look in.
 * @returns {Promise<ListedCable | null>} The cable, or null when none has fibers.
 */
export async function cableWithFibers(page, projectId) {
	const response = await page.request.get(`${API_URL}cable/?project=${projectId}`);
	if (!response.ok()) return null;
	const payload = await response.json();
	const cables = Array.isArray(payload) ? payload : (payload?.results ?? []);
	for (const cable of cables.slice(0, 10)) {
		if (!cable?.uuid || !cable?.name) continue;
		const fibers = await page.request.get(`${API_URL}fiber/by-cable/${cable.uuid}/`);
		if (!fibers.ok()) continue;
		const list = await fibers.json();
		if (Array.isArray(list) && list.length > 0) {
			return { uuid: String(cable.uuid), name: String(cable.name) };
		}
	}
	return null;
}
