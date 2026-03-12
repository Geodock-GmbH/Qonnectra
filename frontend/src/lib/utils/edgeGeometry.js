/**
 * @typedef {{ x: number, y: number }} Point2D
 */

/**
 * Calculates the midpoint position along the entire path length (source -> waypoints -> target).
 * @param {number} srcX - Source X coordinate.
 * @param {number} srcY - Source Y coordinate.
 * @param {number} tgtX - Target X coordinate.
 * @param {number} tgtY - Target Y coordinate.
 * @param {Point2D[]} [waypoints] - Intermediate vertex points along the path.
 * @returns {Point2D} The midpoint coordinates along the path.
 */
export function getPathMidpoint(srcX, srcY, tgtX, tgtY, waypoints) {
	const allPoints = [{ x: srcX, y: srcY }, ...(waypoints || []), { x: tgtX, y: tgtY }];

	const segments = [];
	let totalLength = 0;

	for (let i = 0; i < allPoints.length - 1; i++) {
		const dx = allPoints[i + 1].x - allPoints[i].x;
		const dy = allPoints[i + 1].y - allPoints[i].y;
		const length = Math.sqrt(dx * dx + dy * dy);

		segments.push({
			start: allPoints[i],
			end: allPoints[i + 1],
			length: length,
			cumulativeStart: totalLength,
			cumulativeEnd: totalLength + length
		});

		totalLength += length;
	}

	const targetLength = totalLength / 2;

	for (const segment of segments) {
		if (targetLength >= segment.cumulativeStart && targetLength <= segment.cumulativeEnd) {
			if (segment.length === 0) {
				return { x: segment.start.x, y: segment.start.y };
			}
			const segmentProgress = (targetLength - segment.cumulativeStart) / segment.length;
			return {
				x: segment.start.x + segmentProgress * (segment.end.x - segment.start.x),
				y: segment.start.y + segmentProgress * (segment.end.y - segment.start.y)
			};
		}
	}

	return { x: (srcX + tgtX) / 2, y: (srcY + tgtY) / 2 };
}

/**
 * Finds the closest point on a line segment to a given point using perpendicular projection.
 * @param {Point2D} p - The reference point.
 * @param {Point2D} a - Start point of the segment.
 * @param {Point2D} b - End point of the segment.
 * @returns {Point2D & { t: number }} Closest point on the segment, with `t` as the interpolation parameter (0–1).
 */
export function getClosestPointOnSegment(p, a, b) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared === 0) return { ...a, t: 0 };

	let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
	t = Math.max(0, Math.min(1, t));

	return {
		x: a.x + t * dx,
		y: a.y + t * dy,
		t: t
	};
}

/**
 * Snaps coordinates to the nearest grid point when snapping is enabled.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} gridSize - Grid cell size for snapping.
 * @param {boolean} enabled - Whether grid snapping is active.
 * @returns {Point2D} The (possibly snapped) coordinates.
 */
export function snapToGrid(x, y, gridSize, enabled) {
	if (!enabled) {
		return { x, y };
	}

	return {
		x: Math.round(x / gridSize) * gridSize,
		y: Math.round(y / gridSize) * gridSize
	};
}

/**
 * Builds an SVG path string from source, waypoints, and target coordinates.
 * @param {number} sourceX - Source X coordinate.
 * @param {number} sourceY - Source Y coordinate.
 * @param {number} targetX - Target X coordinate.
 * @param {number} targetY - Target Y coordinate.
 * @param {Point2D[] | null} [waypoints] - Intermediate waypoints.
 * @returns {string | null} SVG path string, or null if no waypoints are provided.
 */
export function buildEdgePath(sourceX, sourceY, targetX, targetY, waypoints) {
	if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
		let path = `M ${sourceX},${sourceY}`;
		waypoints.forEach((point) => {
			path += ` L ${point.x},${point.y}`;
		});
		path += ` L ${targetX},${targetY}`;
		return path;
	}

	return null;
}
