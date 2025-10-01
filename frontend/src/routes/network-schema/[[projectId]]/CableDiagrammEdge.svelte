<script>
	import { BaseEdge, getBezierPath } from '@xyflow/svelte';

	import { drawerStore } from '$lib/stores/drawer';

	let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = $props();

	// Calculate custom path or fallback to bezier
	let edgePath = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;

		if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
			// Build custom path with waypoints
			let path = `M ${sourceX},${sourceY}`;
			waypoints.forEach((point) => {
				path += ` L ${point.x},${point.y}`;
			});
			path += ` L ${targetX},${targetY}`;
			return path;
		} else {
			// Fallback to default bezier path
			const [bezierPath] = getBezierPath({
				sourceX,
				sourceY,
				targetX,
				targetY,
				sourcePosition,
				targetPosition
			});
			return bezierPath;
		}
	});

	// Calculate label position (midpoint of path)
	let labelX = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;
		if (waypoints && waypoints.length > 0) {
			// Use middle waypoint or average position
			const midIdx = Math.floor(waypoints.length / 2);
			return waypoints[midIdx].x;
		}
		return (sourceX + targetX) / 2;
	});

	let labelY = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;
		if (waypoints && waypoints.length > 0) {
			const midIdx = Math.floor(waypoints.length / 2);
			return waypoints[midIdx].y;
		}
		return (sourceY + targetY) / 2;
	});

	function handleEdgeLableClick() {
		drawerStore.open({
			title: data.label || 'Cable Details',
			props: {
				cableId: id,
				cableData: data
			}
		});
	}

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

	/**
	 * Calculate the closest point on a line segment to a given point
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
	 */
	function handleEdgeClick(event) {
		const svg = event.currentTarget.closest('svg');
		const pt = svg.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgCoords = pt.matrixTransform(svg.getScreenCTM().inverse());
		const waypoints = data?.cable?.diagram_path || [];

		// Build all segments of the path (including source and target)
		const allPoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];

		// Find the closest segment to the click point
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

		// Insert the new vertex at the correct position
		const newWaypoints = [...waypoints];
		newWaypoints.splice(closestSegmentIndex, 0, { x: svgCoords.x, y: svgCoords.y });

		// Dispatch custom event to update edge
		window.dispatchEvent(
			new CustomEvent('updateCablePath', {
				detail: { edgeId: id, waypoints: newWaypoints }
			})
		);
	}

	/**
	 * Handle vertex drag start
	 */
	function handleVertexMouseDown(event, index) {
		event.stopPropagation();
		event.preventDefault();
		draggingVertexIndex = index;

		// Store SVG element for coordinate conversion
		svgElement = event.currentTarget.closest('svg');

		// Add window listeners for smooth dragging
		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp);
	}

	/**
	 * Handle vertex drag on window (so it works even when mouse leaves SVG)
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
	 */
	function handleVertexContextMenu(event, index) {
		event.preventDefault();
		event.stopPropagation();

		const waypoints = [...(data?.cable?.diagram_path || [])];
		waypoints.splice(index, 1);

		window.dispatchEvent(
			new CustomEvent('updateCablePath', {
				detail: { edgeId: id, waypoints: waypoints, save: true }
			})
		);
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
		<circle
			class="nopan"
			cx={vertex.x}
			cy={vertex.y}
			r="6"
			fill="var(--color-primary-500)"
			stroke="white"
			pointer-events="all"
			stroke-width="2"
			style="cursor: move; opacity: {edgeHovered || draggingVertexIndex === index ? 1 : 0.3};"
			onmousedown={(e) => handleVertexMouseDown(e, index)}
			oncontextmenu={(e) => handleVertexContextMenu(e, index)}
			aria-label="Drag to move vertex, right-click to delete"
			role="button"
			tabindex="0"
		/>
	{/each}
{/if}

<!-- Custom label positioned in the middle -->
{#if data?.label}
	<foreignObject
		x={labelX - 150}
		y={labelY - 12}
		width="300"
		height="30"
		style="cursor: pointer;"
		onclick={handleEdgeLableClick}
		onkeydown={handleKeydown}
		aria-label="Open cable details for {data.label}"
		role="button"
		tabindex="0"
	>
		<div class="flex items-center justify-center" style="z-index: 100;">
			<div
				class="z-10 bg-surface-50-950 border border-surface-200-700 rounded px-2 py-1 text-xs text-center shadow-sm font-medium"
			>
				{data.label}
			</div>
		</div>
	</foreignObject>
{/if}
