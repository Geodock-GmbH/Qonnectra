<script>
	import { BaseEdge, getSmoothStepPath } from '@xyflow/svelte';
	import { parse } from 'devalue';

	import { edgeSnappingEnabled } from '$lib/stores/store';
	import {
		buildEdgePath,
		getClosestPointOnSegment,
		getPathMidpoint,
		snapToGrid
	} from '$lib/utils/edgeGeometry.js';

	import DynamicEdgeLabel from './DynamicEdgeLabel.svelte';

	let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = $props();

	let currentLabel = $state(data?.label || data?.cable?.name || '');

	let labelData = $state(data?.labelData || null);

	let edgePath = $derived.by(() => {
		const waypoints = data?.cable?.diagram_path;
		const customPath = buildEdgePath(sourceX, sourceY, targetX, targetY, waypoints);

		if (customPath) {
			return customPath;
		}

		const [stepPath] = getSmoothStepPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition
		});
		return stepPath;
	});

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

		const snappedPosition = snapToGrid(
			closestPointOnSegment.x,
			closestPointOnSegment.y,
			SNAP_GRID_SIZE,
			$edgeSnappingEnabled
		);

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

		const snappedPosition = snapToGrid(
			svgCoords.x,
			svgCoords.y,
			SNAP_GRID_SIZE,
			$edgeSnappingEnabled
		);

		if (
			$edgeSnappingEnabled &&
			(snappedPosition.x !== svgCoords.x || snappedPosition.y !== svgCoords.y)
		) {
			showSnapFeedback = true;
			snapFeedbackPosition = { ...snappedPosition };
			setTimeout(() => {
				showSnapFeedback = false;
			}, 200);
		}

		const waypoints = [...(data?.cable?.diagram_path || [])];
		waypoints[draggingVertexIndex] = snappedPosition;

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
		onEdgeDelete={data?.onEdgeDelete}
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
		style="pointer-events: none; z-index: 15;"
	/>
{/if}
