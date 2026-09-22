/**
 * The damage location of a fault simulation in the URL: `?damage=x,y` in
 * the project's storage projection, whole metres. Malformed values read as
 * no damage, so a stray URL shows the map without a simulation.
 */

/**
 * Reads the damage location from the page URL.
 * @param url - The page URL.
 * @returns The location as `[x, y]`, or null when absent or malformed.
 */
export function queryDamage(url: URL): [number, number] | null {
	const raw = url.searchParams.get('damage');
	if (!raw) return null;
	const parts = raw.split(',');
	if (parts.length !== 2) return null;
	const [x, y] = parts.map((part) => (part.trim() === '' ? NaN : Number(part)));
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return [Math.round(x), Math.round(y)];
}

/**
 * Formats a damage location for the URL, rounded to whole metres.
 * @param point - The location as `[x, y]` in the storage projection.
 * @returns `x,y`.
 */
export function formatDamage(point: [number, number]): string {
	return `${Math.round(point[0])},${Math.round(point[1])}`;
}
