import { API_URL } from './auth.js';

/**
 * A feature the backend lists: its uuid and the label the drawer titles it with.
 * @typedef {{ uuid: string, label: string }} ListedFeature
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
	return { uuid: String(uuid), label: String(props.id_trench ?? props.name ?? '') };
}
