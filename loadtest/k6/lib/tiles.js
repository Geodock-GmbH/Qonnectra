/**
 * Viewport-to-tile math for the map scenario, mirroring OpenLayers' defaults
 * in the app: an EPSG:3857 view with 256px-based zoom levels and vector/WMS
 * tile sources on a 512px XYZ grid, so tile zoom = round(view zoom) - 1.
 * Pure functions only, so tiles.test.mjs can run them in Node.
 */

const HALF_WORLD = 20037508.342789244;
const WORLD = HALF_WORLD * 2;
const RESOLUTION_Z0 = WORLD / 256;

const MIN_VIEW_ZOOM = 3;
const MAX_VIEW_ZOOM = 21;

/**
 * @typedef {object} View
 * @property {number} x - Center easting in EPSG:3857.
 * @property {number} y - Center northing in EPSG:3857.
 * @property {number} zoom - OpenLayers view zoom (integer steps here).
 * @property {number} width - Viewport width in CSS pixels.
 * @property {number} height - Viewport height in CSS pixels.
 */

/**
 * @typedef {object} Tile
 * @property {number} z
 * @property {number} x
 * @property {number} y
 */

/**
 * Returns the view resolution in metres per pixel.
 * @param {number} zoom - View zoom.
 * @returns {number}
 */
function resolution(zoom) {
	return RESOLUTION_Z0 / 2 ** zoom;
}

/**
 * Returns the 512px tile zoom OpenLayers picks for a view zoom.
 * @param {number} zoom - View zoom.
 * @returns {number}
 */
export function tileZoom(zoom) {
	return Math.max(0, Math.round(zoom) - 1);
}

/**
 * Returns the view extent in EPSG:3857.
 * @param {View} view
 * @returns {[number, number, number, number]} minX, minY, maxX, maxY.
 */
export function viewExtent(view) {
	const halfW = (view.width * resolution(view.zoom)) / 2;
	const halfH = (view.height * resolution(view.zoom)) / 2;
	return [view.x - halfW, view.y - halfH, view.x + halfW, view.y + halfH];
}

/**
 * Lists the tiles that cover a view.
 * @param {View} view
 * @returns {Tile[]}
 */
export function tilesForView(view) {
	const z = tileZoom(view.zoom);
	const count = 2 ** z;
	const size = WORLD / count;
	const [minX, minY, maxX, maxY] = viewExtent(view);
	const clamp = (/** @type {number} */ v) => Math.min(count - 1, Math.max(0, v));
	const x0 = clamp(Math.floor((minX + HALF_WORLD) / size));
	const x1 = clamp(Math.floor((maxX + HALF_WORLD) / size));
	const y0 = clamp(Math.floor((HALF_WORLD - maxY) / size));
	const y1 = clamp(Math.floor((HALF_WORLD - minY) / size));
	/** @type {Tile[]} */
	const tiles = [];
	for (let x = x0; x <= x1; x++) {
		for (let y = y0; y <= y1; y++) tiles.push({ z, x, y });
	}
	return tiles;
}

/**
 * Returns a tile's bounding box in EPSG:3857, as WMS GetMap expects it.
 * @param {Tile} tile
 * @returns {string} `minX,minY,maxX,maxY`.
 */
export function tileBbox(tile) {
	const size = WORLD / 2 ** tile.z;
	const minX = -HALF_WORLD + tile.x * size;
	const maxY = HALF_WORLD - tile.y * size;
	return `${minX},${maxY - size},${minX + size},${maxY}`;
}

/**
 * Returns the integer view zoom at which an extent fills the viewport, like
 * `view.fit()` when the map opens on a project.
 * @param {[number, number, number, number]} extent - EPSG:3857 extent.
 * @param {number} width - Viewport width in pixels.
 * @param {number} height - Viewport height in pixels.
 * @returns {number}
 */
export function fitZoom(extent, width, height) {
	const spanX = Math.max(extent[2] - extent[0], 1);
	const spanY = Math.max(extent[3] - extent[1], 1);
	const zoom = Math.floor(
		Math.log2(Math.min((RESOLUTION_Z0 * width) / spanX, (RESOLUTION_Z0 * height) / spanY))
	);
	return Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, zoom));
}

/**
 * Moves a view one user gesture: pan by a fraction of the viewport, or zoom
 * one step around the current center. The center stays inside `extent`.
 * @param {View} view - Current view.
 * @param {'pan' | 'zoomIn' | 'zoomOut'} gesture
 * @param {[number, number, number, number]} extent - Area the user works in.
 * @param {() => number} random - Source of [0, 1) numbers.
 * @param {number} minZoom - Lowest zoom the user zooms out to.
 * @returns {View} The next view.
 */
export function step(view, gesture, extent, random, minZoom) {
	if (gesture === 'zoomIn') return { ...view, zoom: Math.min(MAX_VIEW_ZOOM, view.zoom + 1) };
	if (gesture === 'zoomOut') return { ...view, zoom: Math.max(minZoom, view.zoom - 1) };

	const angle = random() * 2 * Math.PI;
	const fraction = 0.3 + random() * 0.4;
	const res = resolution(view.zoom);
	const x = view.x + Math.cos(angle) * fraction * view.width * res;
	const y = view.y + Math.sin(angle) * fraction * view.height * res;
	return {
		...view,
		x: Math.min(extent[2], Math.max(extent[0], x)),
		y: Math.min(extent[3], Math.max(extent[1], y))
	};
}

/**
 * Remembers loaded tiles like an OpenLayers source tile cache, so a pan only
 * requests the tiles that newly came into view. Oldest keys go first.
 */
export class TileCache {
	/** @param {number} capacity - Tiles kept per source before eviction. */
	constructor(capacity) {
		this.capacity = capacity;
		/** @type {Map<string, true>} */
		this.keys = new Map();
	}

	/**
	 * Returns the tiles of `tiles` not cached yet and marks all of them cached.
	 * @param {Tile[]} tiles
	 * @returns {Tile[]}
	 */
	missing(tiles) {
		/** @type {Tile[]} */
		const result = [];
		for (const tile of tiles) {
			const key = `${tile.z}/${tile.x}/${tile.y}`;
			if (this.keys.has(key)) {
				this.keys.delete(key);
			} else {
				result.push(tile);
			}
			this.keys.set(key, true);
		}
		while (this.keys.size > this.capacity) {
			this.keys.delete(/** @type {string} */ (this.keys.keys().next().value));
		}
		return result;
	}
}
