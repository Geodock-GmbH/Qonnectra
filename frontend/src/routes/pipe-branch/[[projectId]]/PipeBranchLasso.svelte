<script>
	import { useNodes, useStore, useSvelteFlow } from '@xyflow/svelte';

	import { getSvgPathFromStroke } from './lassoUtils.js';

	let { partial = false, onSelectionChange } = $props();

	const nodes = useNodes();
	const store = useStore();
	const { flowToScreenPosition, getInternalNode, screenToFlowPosition, getViewport, setViewport } =
		useSvelteFlow();

	let canvas = $state(null);
	let ctx = $state(null);
	let nodePoints = $state({});
	let points = $state([]);
	let selectedNodeIds = $state(new Set());

	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let viewportStart = $state({ x: 0, y: 0, zoom: 1 });

	function handlePointerDown(e) {
		const target = e.target;

		// Middle mouse button (button === 1) for panning
		if (e.button === 1) {
			e.preventDefault();
			isPanning = true;
			panStart = { x: e.clientX, y: e.clientY };
			viewportStart = getViewport();
			target.setPointerCapture(e.pointerId);
			return;
		}

		// Left click for lasso selection
		if (e.button !== 0) return;

		target.setPointerCapture(e.pointerId);

		const rect = target.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const nextPoints = [...points, [x, y]];
		points = nextPoints;

		nodePoints = {};
		for (const node of nodes.current) {
			const internalNode = getInternalNode(node.id);
			if (!internalNode) continue;

			const { x, y } = internalNode.internals.positionAbsolute;
			const { width = 0, height = 0 } = internalNode.measured;

			// Store center point and corners for selection detection
			nodePoints[node.id] = {
				center: [x + width / 2, y + height / 2],
				corners: [
					[x, y],
					[x + width, y],
					[x + width, y + height],
					[x, y + height]
				]
			};
		}

		ctx = canvas?.getContext('2d') || null;
		if (!ctx) return;
		ctx.lineWidth = 1;
		ctx.fillStyle = 'rgba(0, 89, 220, 0.08)';
		ctx.strokeStyle = 'rgba(0, 89, 220, 0.8)';
	}

	function handlePointerMove(e) {
		// Handle panning with middle mouse button
		if (isPanning) {
			const dx = e.clientX - panStart.x;
			const dy = e.clientY - panStart.y;
			setViewport(
				{
					x: viewportStart.x + dx,
					y: viewportStart.y + dy,
					zoom: viewportStart.zoom
				},
				{ duration: 0 }
			);
			return;
		}

		if (e.buttons !== 1) return;

		const rect = e.target.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const nextPoints = [...points, [x, y]];
		points = nextPoints;

		const path = new Path2D(getSvgPathFromStroke(nextPoints));

		if (!ctx) return;
		ctx.clearRect(0, 0, store.width, store.height);
		ctx.fill(path);
		ctx.stroke(path);

		const nodesToSelect = new Set();

		for (const [nodeId, nodeData] of Object.entries(nodePoints)) {
			if (partial) {
				// Partial selection: select node if any corner is in the path
				for (const point of nodeData.corners) {
					const screenPos = flowToScreenPosition({ x: point[0], y: point[1] });
					const canvasRect = e.target.getBoundingClientRect();
					const canvasX = screenPos.x - canvasRect.left;
					const canvasY = screenPos.y - canvasRect.top;
					if (ctx.isPointInPath(path, canvasX, canvasY)) {
						nodesToSelect.add(nodeId);
						break;
					}
				}
			} else {
				// Full selection: select node if CENTER is in the path (easier to select)
				const center = nodeData.center;
				const screenPos = flowToScreenPosition({ x: center[0], y: center[1] });
				const canvasRect = e.target.getBoundingClientRect();
				const canvasX = screenPos.x - canvasRect.left;
				const canvasY = screenPos.y - canvasRect.top;
				if (ctx.isPointInPath(path, canvasX, canvasY)) {
					nodesToSelect.add(nodeId);
				}
			}
		}

		selectedNodeIds = nodesToSelect;

		// Update nodes with selection state
		nodes.update((nodes) =>
			nodes.map((node) => ({
				...node,
				selected: nodesToSelect.has(node.id)
			}))
		);
	}

	function handlePointerUp(e) {
		const target = e.target;

		// Handle end of panning
		if (isPanning) {
			isPanning = false;
			target.releasePointerCapture(e.pointerId);
			return;
		}

		target.releasePointerCapture(e.pointerId);
		points = [];
		if (ctx) {
			ctx.clearRect(0, 0, store.width, store.height);
		}

		// Notify parent component of selection change
		if (onSelectionChange) {
			onSelectionChange(Array.from(selectedNodeIds));
		}
	}

	/**
	 * Handle mouse wheel for zooming to cursor position
	 */
	function handleWheel(e) {
		e.preventDefault();

		const { x: viewportX, y: viewportY, zoom } = getViewport();

		// Smoother zoom: 5% per wheel tick instead of 15%
		// deltaY > 0 means scroll down = zoom out
		const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
		const newZoom = Math.max(store.minZoom, Math.min(store.maxZoom, zoom * zoomFactor));

		// Get mouse position relative to the canvas
		const rect = e.currentTarget.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Calculate the point in flow coordinates under the mouse
		const flowX = (mouseX - viewportX) / zoom;
		const flowY = (mouseY - viewportY) / zoom;

		// Calculate new viewport to keep that point under the mouse
		const newViewportX = mouseX - flowX * newZoom;
		const newViewportY = mouseY - flowY * newZoom;

		setViewport({ x: newViewportX, y: newViewportY, zoom: newZoom }, { duration: 0 });
	}

	// Clear selection when component is destroyed or selection is externally cleared
	export function clearSelection() {
		selectedNodeIds = new Set();
		nodes.update((nodes) =>
			nodes.map((node) => ({
				...node,
				selected: false
			}))
		);
		if (onSelectionChange) {
			onSelectionChange([]);
		}
	}
</script>

<canvas
	bind:this={canvas}
	width={store.width}
	height={store.height}
	class="tool-overlay"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onwheel={handleWheel}
></canvas>

<style>
	.tool-overlay {
		position: absolute;
		z-index: 5;
		height: 100%;
		width: 100%;
		touch-action: none;
		cursor: crosshair;
	}
</style>
