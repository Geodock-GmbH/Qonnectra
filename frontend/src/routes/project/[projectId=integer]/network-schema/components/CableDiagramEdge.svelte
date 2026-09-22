<script lang="ts">
	import type { EdgeProps } from '@xyflow/svelte';
	import type { EdgeLabelData } from '$lib/classes/NetworkSchemaState.svelte';
	import { BaseEdge, getSmoothStepPath } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import {
		cableDirectionAnimationEnabled,
		cableEdgeColorMode,
		edgeSnappingEnabled
	} from '$lib/stores/store';
	import {
		buildEdgePath,
		getClosestPointOnSegment,
		getPathMidpoint,
		snapToGrid
	} from '$lib/utils/edgeGeometry';
	import { getSchemaState } from '$lib/context/networkSchemaContext';

	import DynamicEdgeLabel from './DynamicEdgeLabel.svelte';

	type Waypoint = { x: number; y: number };

	type CableEdgeData = {
		label?: string;
		isConnected?: boolean;
		lowestMicropipe?: { color_hex?: string };
		cable?: { uuid?: string; name?: string; diagram_path?: Waypoint[] };
		labelData?: Partial<EdgeLabelData> | null;
	};

	let {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		data,
		selected
	}: EdgeProps & { data: CableEdgeData } = $props();

	const schemaState = getSchemaState();

	const DEFAULT_GREEN = '#22c55e';
	const LINKED_BLUE = '#3b82f6';

	/**
	 * Compute the edge stroke color based on the current color mode setting
	 */
	let strokeColor = $derived.by(() => {
		const mode = $cableEdgeColorMode;

		if (mode === 'default') {
			return DEFAULT_GREEN;
		}

		if (mode === 'linked') {
			// Green when not connected, Blue when connected to at least one micropipe
			return data?.isConnected ? LINKED_BLUE : DEFAULT_GREEN;
		}

		if (mode === 'micropipe') {
			// Use the color from the lowest numbered micropipe
			const lowestMicropipe = data?.lowestMicropipe;
			const hexColor = lowestMicropipe?.color_hex;
			// Validate hex color format before using it
			if (hexColor && /^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
				return hexColor;
			}
			// Fall back to green if no connection or invalid color
			return DEFAULT_GREEN;
		}

		return DEFAULT_GREEN;
	});

	let edgeStyle = $derived.by(() => {
		// The cable in edit mode gets a primary-colored halo to stand out; a merely
		// selected cable keeps its own-color glow. Both thicken the stroke.
		if (schemaState.isEditing(id)) {
			return `stroke: ${strokeColor}; stroke-width: 4; filter: drop-shadow(0 0 6px var(--color-primary-500));`;
		}
		if (selected) {
			return `stroke: ${strokeColor}; stroke-width: 4; filter: drop-shadow(0 0 4px ${strokeColor});`;
		}
		return `stroke: ${strokeColor}; stroke-width: 2;`;
	});

	let currentLabel = $derived(data?.label || data?.cable?.name || '');
	let labelData = $derived(data?.labelData ?? null);

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
	 * Delete the cable's label via the schema state (single owner).
	 * @param labelId - The UUID of the label to delete
	 * @returns Whether the delete persisted, so the label can roll back on failure
	 */
	function handleLabelReset(labelId: string): Promise<boolean> {
		return schemaState.resetLabel(id, labelId);
	}

	/**
	 * Persist the cable label's position via the schema state (single owner).
	 * @returns Whether the save persisted, so the label can clear its optimistic override
	 */
	function handleLabelPositionUpdate(positionData: {
		x: number;
		y: number;
		text?: string;
		labelId?: string;
	}): Promise<boolean> {
		return schemaState.saveLabelPosition(id, positionData);
	}

	let draggingVertexIndex = $state<number | null>(null);
	let edgeHovered = $state(false);
	let svgElement = $state<SVGSVGElement | null>(null);
	let hoveredVertexIndex = $state<number | null>(null);

	const SNAP_GRID_SIZE = 20;
	let showSnapFeedback = $state(false);
	let snapFeedbackPosition = $state({ x: 0, y: 0 });

	/**
	 * Handle click on edge to add a new vertex
	 */
	function handleEdgeClick(event: MouseEvent) {
		if (!schemaState.isEditing(id)) return;

		const svg = (event.currentTarget as Element).closest('svg') as SVGSVGElement;
		const pt = svg.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgCoords = pt.matrixTransform((svg.getScreenCTM() as DOMMatrix).inverse());
		const waypoints = data?.cable?.diagram_path || [];

		const allPoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];

		let closestSegmentIndex = 0;
		let minDistance = Infinity;
		let closestPointOnSegment: Waypoint | null = null;

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
			(closestPointOnSegment as Waypoint).x,
			(closestPointOnSegment as Waypoint).y,
			SNAP_GRID_SIZE,
			$edgeSnappingEnabled
		);

		const newWaypoints = [...waypoints];
		newWaypoints.splice(closestSegmentIndex, 0, snappedPosition);

		schemaState.updateCablePathWaypoints(id, newWaypoints);
	}

	/**
	 * Handle vertex click - delete if Shift is pressed, otherwise start drag
	 */
	function handleVertexMouseDown(event: MouseEvent, index: number) {
		if (!schemaState.isEditing(id)) return;

		event.stopPropagation();
		event.preventDefault();

		// The event's own modifier is authoritative; the tracked shiftPressed
		// state (used only for the hover cue) can go stale when the keydown
		// happened while focus was outside the window.
		if (event.shiftKey) {
			deleteVertex(index);
			return;
		}

		draggingVertexIndex = index;
		svgElement = (event.currentTarget as Element).closest('svg');
		schemaState.beginPathDrag(id);

		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp);
	}

	/**
	 * Delete a vertex at the given index
	 */
	function deleteVertex(index: number) {
		const waypoints = [...(data?.cable?.diagram_path || [])];
		waypoints.splice(index, 1);

		void schemaState.saveCablePath(id, waypoints);
	}

	/**
	 * Handle vertex drag on window (so it works even when mouse leaves SVG)
	 */
	function handleWindowMouseMove(event: MouseEvent) {
		if (draggingVertexIndex === null || !svgElement) return;

		const pt = svgElement.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgCoords = pt.matrixTransform((svgElement.getScreenCTM() as DOMMatrix).inverse());

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

		schemaState.dragPathVertex(id, draggingVertexIndex, snappedPosition);
	}

	/**
	 * Handle vertex drag end on window
	 */
	function handleWindowMouseUp() {
		if (draggingVertexIndex !== null) {
			void schemaState.endPathDrag(id);
		}
		draggingVertexIndex = null;
		svgElement = null;

		window.removeEventListener('mousemove', handleWindowMouseMove);
		window.removeEventListener('mouseup', handleWindowMouseUp);
	}

	/**
	 * Suppress the browser context menu on a vertex right-click.
	 */
	function handleVertexContextMenu(event: MouseEvent) {
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
			handleEdgeClick(e as unknown as MouseEvent);
		}
	}}
	onmouseenter={() => (edgeHovered = true)}
	onmouseleave={() => (edgeHovered = false)}
	style="cursor: {schemaState.isEditing(id) ? 'pointer' : 'default'}; outline: none;"
	role="button"
	tabindex="0"
>
	<BaseEdge
		{id}
		path={edgePath}
		interactionWidth={schemaState.isEditing(id) ? 20 : 0}
		style={edgeStyle}
		aria-label={m.tooltip_open_cable_details({ label: data.label ?? '' })}
	/>
</g>

<!-- Direction animation overlay -->
{#if $cableDirectionAnimationEnabled}
	<path
		d={edgePath}
		fill="none"
		stroke="white"
		stroke-width="2"
		stroke-dasharray="8,12"
		stroke-linecap="round"
		style="pointer-events: none;"
		class="animate-flow"
	/>
{/if}

<!-- Vertex handles (only shown for the cable in edit mode) -->
{#if schemaState.isEditing(id) && data?.cable?.diagram_path && Array.isArray(data.cable.diagram_path)}
	{#each data.cable.diagram_path as vertex, index (index)}
		{@const isHovered = hoveredVertexIndex === index}
		{@const isDeleteMode = schemaState.shiftPressed && isHovered}
		{@const fillColor = isDeleteMode ? 'var(--color-error-500)' : strokeColor}
		{@const cursorStyle = schemaState.shiftPressed ? 'cursor: crosshair;' : 'cursor: move;'}
		<!--
			`nokey`: with the canvas unlocked in edit mode, `elementsSelectable` is
			true, so holding Shift arms SvelteFlow's box-selection. Its Pane
			`onpointerdowncapture` then calls `preventDefault()` on the vertex
			pointerdown, which suppresses the compat `mousedown` — so
			`handleVertexMouseDown` (Shift = delete, plain = drag) would never run.
			`nokey` opts the vertex out of that capture, letting its own mousedown
			fire. `nopan` only suppresses panning, not this selection capture.
		-->
		<circle
			class="nopan nokey"
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
			oncontextmenu={handleVertexContextMenu}
			aria-label={schemaState.shiftPressed
				? m.tooltip_click_to_delete_vertex()
				: m.tooltip_drag_to_move_vertex()}
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
		onLabelReset={handleLabelReset}
		onEdgeDelete={(edgeId: string) => schemaState.handleEdgeDelete(edgeId)}
		onEdgeSelect={(edgeId: string) => schemaState.selectEdge(edgeId)}
		onNameUpdate={(newName: string) => schemaState.updateEdgeName(id, newName)}
		{selected}
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

<style>
	.animate-flow {
		animation: flow 1s linear infinite;
	}

	@keyframes flow {
		from {
			stroke-dashoffset: 20;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
