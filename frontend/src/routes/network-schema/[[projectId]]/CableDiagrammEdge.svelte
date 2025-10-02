<script>
	// SvelteFlow
	import { BaseEdge, getSmoothStepPath } from '@xyflow/svelte';
	// Svelte
	import { drawerStore } from '$lib/stores/drawer';

	let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = $props();

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
	 * Handle click on edge label to open cable details
	 */
	function handleEdgeLableClick() {
		drawerStore.open({
			title: data.label || 'Cable Details',
			props: {
				cableId: id,
				cableData: data
			}
		});
	}

	/**
	 * Handle keydown on edge label to open cable details
	 */
	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleEdgeLableClick();
		}
	}

	// Vertex editing state
	let draggingVertexIndex = $state(null);
	let edgeHovered = $state(false);
	let svgElement = $state(null);
	let shiftPressed = $state(false);
	let hoveredVertexIndex = $state(null);
	let labelElement = $state(null);
	let labelWidth = $state(0);

	/**
	 * Update labelWidth when labelElement is bound and when label changes
	 */
	$effect(() => {
		if (labelElement && data?.label) {
			labelWidth = labelElement.offsetWidth + 20;
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

		const newWaypoints = [...waypoints];
		newWaypoints.splice(closestSegmentIndex, 0, { x: svgCoords.x, y: svgCoords.y });

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

		const waypoints = [...(data?.cable?.diagram_path || [])];
		waypoints[draggingVertexIndex] = { x: svgCoords.x, y: svgCoords.y };

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
		deleteVertex(index);
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

<!-- Custom label positioned in the middle -->
{#if data?.label}
	<foreignObject
		x={labelWidth > 0 ? labelX - labelWidth / 2 : labelX - 50}
		y={labelY - 12}
		width={labelWidth > 0 ? labelWidth : 100}
		height="30"
		style="cursor: pointer; pointer-events: bounding-box;"
		onclick={handleEdgeLableClick}
		onkeydown={handleKeydown}
		aria-label="Open cable details for {data.label}"
		role="button"
		tabindex="0"
	>
		<div class="flex items-center justify-center">
			<div
				bind:this={labelElement}
				class="z-10 bg-surface-50-950 border border-surface-200-700 rounded px-2 py-1 text-xs text-center shadow-sm font-medium"
			>
				{data.label}
			</div>
		</div>
	</foreignObject>
{/if}
