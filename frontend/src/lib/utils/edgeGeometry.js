/**
 * Pure utility functions for edge geometry calculations
 * No Svelte dependencies - fully testable
 */

/**
 * Calculate the midpoint position along the entire path length
 * @param {number} srcX - Source X coordinate
 * @param {number} srcY - Source Y coordinate
 * @param {number} tgtX - Target X coordinate
 * @param {number} tgtY - Target Y coordinate
 * @param {Array} waypoints - Array of vertex points
 * @returns {Object} Object with x and y coordinates of the midpoint
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
 * Calculate the closest point on a line segment to a given point
 * @param {Object} p - The point to find the closest point on the segment to
 * @param {Object} a - The start point of the segment
 * @param {Object} b - The end point of the segment
 * @returns {Object} The closest point on the segment
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
 * Snap coordinates to the nearest grid point
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} gridSize - Grid size for snapping
 * @param {boolean} enabled - Whether snapping is enabled
 * @returns {Object} Snapped coordinates
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
 * Build SVG path string from waypoints
 * @param {number} sourceX - Source X coordinate
 * @param {number} sourceY - Source Y coordinate
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @param {Array|null} waypoints - Array of waypoint objects with x, y properties
 * @returns {string} SVG path string
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
