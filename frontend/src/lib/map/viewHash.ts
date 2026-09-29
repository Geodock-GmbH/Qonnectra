/**
 * The map view carried in the URL hash as `#map={zoom}/{x}/{y}`, in the view
 * projection (EPSG:3857, whole metres) with the zoom to one decimal. The hash
 * never reaches the server and reruns no `load`, and the OpenLayers view
 * already runs in 3857, so it round-trips without a transform.
 */

/** A map view: zoom level and centre in EPSG:3857. */
export interface MapView {
	zoom: number;
	center: [number, number];
}

const VIEW_KEY = 'map';

/** Zooms within this distance count as the same view (one decimal of zoom). */
const ZOOM_TOLERANCE = 0.05;

/** Centres within this distance count as the same view (whole metres). */
const CENTER_TOLERANCE = 0.5;

/**
 * Splits a hash into its `key=value` parts, tolerating a leading `#`.
 * @param hash - `location.hash` or `url.hash`.
 */
function partsOf(hash: string): string[] {
	const body = hash.startsWith('#') ? hash.slice(1) : hash;
	return body.split('&').filter((part) => part !== '');
}

/**
 * Reads the map view from a hash. Anything malformed, from a missing part to
 * a non-finite number, reads as no view, so a stray hash never breaks the map.
 * Other hash content is ignored.
 * @param hash - `location.hash` or `url.hash`, with or without the `#`.
 * @returns The view, or null when the hash carries none.
 */
export function parseViewHash(hash: string): MapView | null {
	const part = partsOf(hash).find((candidate) => candidate.startsWith(`${VIEW_KEY}=`));
	if (!part) return null;
	const fields = part.slice(VIEW_KEY.length + 1).split('/');
	if (fields.length !== 3) return null;
	const [zoom, x, y] = fields.map((field) => (field.trim() === '' ? NaN : Number(field)));
	if (![zoom, x, y].every(Number.isFinite)) return null;
	return { zoom: roundZoom(zoom), center: [Math.round(x), Math.round(y)] };
}

/**
 * Formats a view as the `map=` hash part, rounding the zoom to one decimal
 * and the centre to whole metres.
 * @param view - The view to format.
 * @returns `map={zoom}/{x}/{y}` without the `#`.
 */
export function formatViewHash(view: MapView): string {
	const [x, y] = view.center;
	return `${VIEW_KEY}=${roundZoom(view.zoom)}/${Math.round(x)}/${Math.round(y)}`;
}

/**
 * Writes a view into a hash, replacing an existing `map=` part and keeping
 * every other part where it is.
 * @param hash - The current hash, with or without the `#`.
 * @param view - The view to carry.
 * @returns The new hash including the `#`.
 */
export function withViewHash(hash: string, view: MapView): string {
	const others = partsOf(hash).filter((part) => !part.startsWith(`${VIEW_KEY}=`));
	return `#${[formatViewHash(view), ...others].join('&')}`;
}

/**
 * Whether two views differ by no more than the rounding the hash applies, so
 * a hash the map itself wrote never moves the map again.
 * @param a - One view.
 * @param b - The other view.
 */
export function sameView(a: MapView, b: MapView): boolean {
	return (
		Math.abs(a.zoom - b.zoom) < ZOOM_TOLERANCE &&
		Math.abs(a.center[0] - b.center[0]) < CENTER_TOLERANCE &&
		Math.abs(a.center[1] - b.center[1]) < CENTER_TOLERANCE
	);
}

function roundZoom(zoom: number): number {
	return Math.round(zoom * 10) / 10;
}
