import type { StrokeOptions } from 'perfect-freehand';
import getStroke from 'perfect-freehand';

export const pathOptions: StrokeOptions = {
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
 */
export function getSvgPathFromStroke(stroke: number[][]): string {
	if (!stroke.length) return '';

	const d = stroke.reduce(
		(acc, [x0, y0], i, arr) => {
			const [x1, y1] = arr[(i + 1) % arr.length];
			acc.push(x0, y0, ',', (x0 + x1) / 2, (y0 + y1) / 2);
			return acc;
		},
		['M', ...stroke[0], 'Q'] as (string | number)[]
	);

	d.push('Z');
	return d.join(' ');
}

/**
 * Generates an SVG path from raw pointer points, applying stroke smoothing scaled by zoom level.
 */
export function pointsToPath(points: number[][], zoom = 1): string {
	const stroke = getStroke(points, {
		...pathOptions,
		size: (pathOptions.size ?? 7) * zoom
	});
	return getSvgPathFromStroke(stroke);
}
