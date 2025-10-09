<script>
	// SvelteFlow
	import { BaseEdge, getSmoothStepPath } from '@xyflow/svelte';
	// Svelte
	import { edgeSnappingEnabled } from '$lib/stores/store';
	import { parse } from 'devalue';
	import DynamicEdgeLabel from './DynamicEdgeLabel.svelte';

	let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = $props();

	let currentLabel = $state(data?.label || data?.cable?.name || '');

	let labelData = $state(data?.labelData || null);

	// Calculate custom path or fallback to bezier
	let edgePath = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;

		if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
			let path = `M ${sourceX},${sourceY}`;
			waypoints.forEach((point) => {
				path += ` L ${point.x},${point.y}`;
			});
			path += ` L ${targetX},${targetY}`;
			return path;
		} else {
			// Fallback to default smooth step path
			const [stepPath] = getSmoothStepPath({
				sourceX,
				sourceY,
				targetX,
				targetY,
				sourcePosition,
				targetPosition
			});
			return stepPath;
		}
	});

	/**
	 * Calculate the midpoint position along the entire path length
	 * @param {number} srcX - Source X coordinate
	 * @param {number} srcY - Source Y coordinate
	 * @param {number} tgtX - Target X coordinate
	 * @param {number} tgtY - Target Y coordinate
	 * @param {Array} waypoints - Array of vertex points
	 * @returns {Object} Object with x and y coordinates of the midpoint
	 */
	function getPathMidpoint(srcX, srcY, tgtX, tgtY, waypoints) {
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
				const segmentProgress = (targetLength - segment.cumulativeStart) / segment.length;
				return {
					x: segment.start.x + segmentProgress * (segment.end.x - segment.start.x),
					y: segment.start.y + segmentProgress * (segment.end.y - segment.start.y)
				};
			}
		}

		return { x: (srcX + tgtX) / 2, y: (srcY + tgtY) / 2 };
	}

	// Calculate label position (midpoint of path)
	let labelX = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;
		const midpoint = getPathMidpoint(sourceX, sourceY, targetX, targetY, waypoints);
		return midpoint.x;
	});

	let labelY = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;
		const midpoint = getPathMidpoint(sourceX, sourceY, targetX, targetY, waypoints);
		return midpoint.y;
	});

	/**
	 * Handle label position update - saves to backend via server action
	 * @param {Object} positionData - Object with labelId, x, y, and text coordinates
	 */
	async function handleLabelPositionUpdate(positionData) {
		const cableUuid = data?.cable?.uuid;
		if (!cableUuid) return;

		try {
			const formData = new FormData();
			formData.append('cableId', cableUuid);
			formData.append('position_x', positionData.x.toString());
			formData.append('position_y', positionData.y.toString());
			formData.append('text', positionData.text || currentLabel);
			formData.append('order', '0');

			if (positionData.labelId) {
				formData.append('labelId', positionData.labelId);
			}

			const response = await fetch('?/updateCableLabel', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			// Parse the devalue-serialized response from the action
			const actionResult = typeof result.data === 'string' ? parse(result.data) : result.data;

			if (actionResult?.type === 'success' && actionResult.label) {
				labelData = actionResult.label;
				console.log('Label saved successfully:', labelData);
			} else if (actionResult?.type === 'error') {
				console.error('Failed to save label position:', actionResult.message);
			}
		} catch (error) {
			console.error('Failed to save label position:', error);
		}
	}

	// Vertex editing state
	let draggingVertexIndex = $state(null);
	let edgeHovered = $state(false);
	let svgElement = $state(null);
	let shiftPressed = $state(false);
	let hoveredVertexIndex = $state(null);

	// Edge snapping
	const SNAP_GRID_SIZE = 20;
	let showSnapFeedback = $state(false);
	let snapFeedbackPosition = $state({ x: 0, y: 0 });

	/**
	 * Sync currentLabel when data changes
	 */
	$effect(() => {
		if (data?.label) {
			currentLabel = data.label;
		}
	});

	/**
	 * Calculate the closest point on a line segment to a given point
	 * @param {Object} p - The point to find the closest point on the segment to
	 * @param {Object} a - The start point of the segment
	 * @param {Object} b - The end point of the segment
	 * @returns {Object} The closest point on the segment
	 */
	function getClosestPointOnSegment(p, a, b) {
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
	 * @param {boolean} showFeedback - Whether to show visual feedback
	 * @returns {Object} Snapped coordinates
	 */
	function snapToGrid(x, y, gridSize = SNAP_GRID_SIZE, showFeedback = false) {
		// If snapping is disabled, return original coordinates
		if (!$edgeSnappingEnabled) {
			return { x, y };
		}

		const snapped = {
			x: Math.round(x / gridSize) * gridSize,
			y: Math.round(y / gridSize) * gridSize
		};

		// Show visual feedback if snapping occurred and feedback is requested
		if (showFeedback && (snapped.x !== x || snapped.y !== y)) {
			showSnapFeedback = true;
			snapFeedbackPosition = { ...snapped };
			// Hide feedback after a short delay
			setTimeout(() => {
				showSnapFeedback = false;
			}, 200);
		}

		return snapped;
	}

	/**
	 * Handle click on edge to add a new vertex
	 * @param {Object} event - The click event
	 */
	function handleEdgeClick(event) {
		const svg = event.currentTarget.closest('svg');
		const pt = svg.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgCoords = pt.matrixTransform(svg.getScreenCTM().inverse());
		const waypoints = data?.cable?.diagram_path || [];

		const allPoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];

		let closestSegmentIndex = 0;
		let minDistance = Infinity;
		let closestPointOnSegment = null;

		for (let i = 0; i < allPoints.length - 1; i++) {
			const closest = getClosestPointOnSegment(svgCoords, allPoints[i], allPoints[i + 1]);
			const distance = Math.sqrt(
				Math.pow(closest.x - svgCoords.x, 2) + Math.pow(closest.y - svgCoords.y, 2)
			);

			if (distance < minDistance) {
				minDistance = distance;
				closestSegmentIndex = i;
				closestPointOnSegment = closest;
			}
		}

		// Snap the new vertex to the grid
		const snappedPosition = snapToGrid(closestPointOnSegment.x, closestPointOnSegment.y);

		const newWaypoints = [...waypoints];
		newWaypoints.splice(closestSegmentIndex, 0, snappedPosition);

		window.dispatchEvent(
			new CustomEvent('updateCablePath', {
				detail: { edgeId: id, waypoints: newWaypoints }
			})
		);
	}

	/**
	 * Handle keyboard events for Shift key tracking
	 * @param {Object} event - The keyboard event
	 */
	function handleKeyDown(event) {
		if (event.key === 'Shift') {
			shiftPressed = true;
		}
	}

	/**
	 * Handle keyup event for Shift key tracking
	 * @param {Object} event - The keyboard event
	 */
	function handleKeyUp(event) {
		if (event.key === 'Shift') {
			shiftPressed = false;
		}
	}

	// Attach keyboard listeners on mount
	$effect(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	});

	/**
	 * Handle vertex click - delete if Shift is pressed, otherwise start drag
	 * @param {Object} event - The click event
	 * @param {number} index - The index of the vertex
	 */
	function handleVertexMouseDown(event, index) {
		event.stopPropagation();
		event.preventDefault();

		// If Shift is pressed, delete the vertex
		if (shiftPressed) {
			deleteVertex(index);
			return;
		}

		// Otherwise, start dragging
		draggingVertexIndex = index;

		// Store SVG element for coordinate conversion
		svgElement = event.currentTarget.closest('svg');

		// Add window listeners for smooth dragging
		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp);
	}

	/**
	 * Delete a vertex at the given index
	 * @param {number} index - The index of the vertex
	 */
	function deleteVertex(index) {
		const waypoints = [...(data?.cable?.diagram_path || [])];
		waypoints.splice(index, 1);

		window.dispatchEvent(
			new CustomEvent('updateCablePath', {
				detail: { edgeId: id, waypoints: waypoints, save: true }
			})
		);
	}

	/**
	 * Handle vertex drag on window (so it works even when mouse leaves SVG)
	 * @param {Object} event - The mouse move event
	 */
	function handleWindowMouseMove(event) {
		if (draggingVertexIndex === null || !svgElement) return;

		const pt = svgElement.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgCoords = pt.matrixTransform(svgElement.getScreenCTM().inverse());

		// Snap the dragged vertex to the grid with visual feedback
		const snappedPosition = snapToGrid(svgCoords.x, svgCoords.y, SNAP_GRID_SIZE, true);

		const waypoints = [...(data?.cable?.diagram_path || [])];
		waypoints[draggingVertexIndex] = snappedPosition;

		// Dispatch custom event to update edge
		window.dispatchEvent(
			new CustomEvent('updateCablePath', {
				detail: { edgeId: id, waypoints: waypoints, temporary: true }
			})
		);
	}

	/**
	 * Handle vertex drag end on window
	 * @param {Object} event - The mouse up event
	 */
	function handleWindowMouseUp() {
		if (draggingVertexIndex !== null) {
			// Final update
			window.dispatchEvent(
				new CustomEvent('updateCablePath', {
					detail: { edgeId: id, waypoints: data?.cable?.diagram_path, save: true }
				})
			);
		}
		draggingVertexIndex = null;
		svgElement = null;

		// Remove window listeners
		window.removeEventListener('mousemove', handleWindowMouseMove);
		window.removeEventListener('mouseup', handleWindowMouseUp);
	}

	/**
	 * Handle vertex right-click to delete
	 * @param {Object} event - The right-click event
	 * @param {number} index - The index of the vertex
	 */
	function handleVertexContextMenu(event, index) {
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<!-- Base edge with interaction -->
<g
	onclick={handleEdgeClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleEdgeClick(e);
		}
	}}
	onmouseenter={() => (edgeHovered = true)}
	onmouseleave={() => (edgeHovered = false)}
	style="cursor: pointer;"
	role="button"
	tabindex="0"
>
	<BaseEdge
		{id}
		path={edgePath}
		interactionWidth={20}
		style="stroke: var(--color-primary-500); stroke-width: 2;"
		aria-label="Open cable details for {data.label}"
	/>
</g>

<!-- Vertex handles -->
{#if data?.cable?.diagram_path && Array.isArray(data.cable.diagram_path)}
	{#each data.cable.diagram_path as vertex, index}
		{@const isHovered = hoveredVertexIndex === index}
		{@const isDeleteMode = shiftPressed && isHovered}
		{@const fillColor = isDeleteMode ? 'var(--color-error-500)' : 'var(--color-primary-500)'}
		{@const cursorStyle = shiftPressed ? 'cursor: crosshair;' : 'cursor: move;'}
		<circle
			class="nopan"
			cx={vertex.x}
			cy={vertex.y}
			r="6"
			fill={fillColor}
			stroke="white"
			pointer-events="all"
			stroke-width="2"
			style="{cursorStyle} opacity: {edgeHovered || draggingVertexIndex === index ? 1 : 0.3};"
			onmousedown={(e) => handleVertexMouseDown(e, index)}
			onmouseenter={() => (hoveredVertexIndex = index)}
			onmouseleave={() => (hoveredVertexIndex = null)}
			oncontextmenu={(e) => handleVertexContextMenu(e, index)}
			aria-label={shiftPressed
				? 'Click to delete vertex'
				: 'Drag to move vertex, Shift+Click or right-click to delete'}
			role="button"
			tabindex="0"
		/>
	{/each}
{/if}

<!-- Dynamic label with position support -->
{#if currentLabel}
	<DynamicEdgeLabel
		edgeId={id}
		{labelData}
		cableData={data}
		defaultX={labelX}
		defaultY={labelY}
		onPositionUpdate={handleLabelPositionUpdate}
	/>
{/if}

<!-- Visual feedback for grid snapping -->
{#if showSnapFeedback}
	<circle
		cx={snapFeedbackPosition.x}
		cy={snapFeedbackPosition.y}
		r="8"
		fill="none"
		stroke="var(--color-primary-400)"
		stroke-width="2"
		stroke-dasharray="4,4"
		opacity="0.8"
		class="animate-pulse"
		style="pointer-events: none; z-index: 5;"
	/>
{/if}
