interface Point2D {
	x: number;
	y: number;
}

/**
 * Calculates the midpoint position along the entire path length (source -> waypoints -> target).
 * @param srcX - Source X coordinate.
 * @param srcY - Source Y coordinate.
 * @param tgtX - Target X coordinate.
 * @param tgtY - Target Y coordinate.
 * @param waypoints - Intermediate vertex points along the path.
 */
export function getPathMidpoint(
	srcX: number,
	srcY: number,
	tgtX: number,
	tgtY: number,
	waypoints?: Point2D[]
): Point2D {
	const allPoints = [{ x: srcX, y: srcY }, ...(waypoints || []), { x: tgtX, y: tgtY }];

	const segments: Array<{
		start: Point2D;
		end: Point2D;
		length: number;
		cumulativeStart: number;
		cumulativeEnd: number;
	}> = [];
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
 * @param p - The reference point.
 * @param a - Start point of the segment.
 * @param b - End point of the segment.
 */
export function getClosestPointOnSegment(
	p: Point2D,
	a: Point2D,
	b: Point2D
): Point2D & { t: number } {
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
 * @param x - X coordinate.
 * @param y - Y coordinate.
 * @param gridSize - Grid cell size for snapping.
 * @param enabled - Whether grid snapping is active.
 */
export function snapToGrid(x: number, y: number, gridSize: number, enabled: boolean): Point2D {
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
 * @param sourceX - Source X coordinate.
 * @param sourceY - Source Y coordinate.
 * @param targetX - Target X coordinate.
 * @param targetY - Target Y coordinate.
 * @param waypoints - Intermediate waypoints.
 */
export function buildEdgePath(
	sourceX: number,
	sourceY: number,
	targetX: number,
	targetY: number,
	waypoints?: Point2D[] | null
): string | null {
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
