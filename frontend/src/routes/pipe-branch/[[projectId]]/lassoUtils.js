import getStroke from 'perfect-freehand';

/** @type {import('perfect-freehand').StrokeOptions} */
export const pathOptions = {
	size: 7,
	thinning: 0.5,
	smoothing: 0.5,
	streamline: 0.5,
	easing: (t) => t,
	start: {
		taper: 0,
		easing: (t) => t,
		cap: true
	},
	end: {
		taper: 0.1,
		easing: (t) => t,
		cap: true
	}
};

/**
 * Converts an array of stroke points into a closed SVG path string using quadratic curves.
 * @param {number[][]} stroke - Array of [x, y] points from perfect-freehand
 * @returns {string} SVG path data string, or empty string if no points.
 */
export function getSvgPathFromStroke(stroke) {
	if (!stroke.length) return '';

	const d = stroke.reduce(
		(acc, [x0, y0], i, arr) => {
			const [x1, y1] = arr[(i + 1) % arr.length];
			acc.push(x0, y0, ',', (x0 + x1) / 2, (y0 + y1) / 2);
			return acc;
		},
		['M', ...stroke[0], 'Q']
	);

	d.push('Z');
	return d.join(' ');
}

/**
 * Generates an SVG path from raw pointer points, applying stroke smoothing scaled by zoom level.
 * @param {number[][]} points - Array of [x, y] raw pointer coordinates
 * @param {number} [zoom=1] - Current viewport zoom level
 * @returns {string} SVG path data string.
 */
export function pointsToPath(points, zoom = 1) {
	const stroke = getStroke(points, {
		...pathOptions,
		size: (pathOptions.size ?? 7) * zoom
	});
	return getSvgPathFromStroke(stroke);
}
