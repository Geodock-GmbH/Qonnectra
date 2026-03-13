<script>
	import { useNodes, useStore, useSvelteFlow } from '@xyflow/svelte';

	import { getSvgPathFromStroke } from './lassoUtils.js';

	let { partial = false, onSelectionChange } = $props();

	const nodes = useNodes();
	const store = useStore();
	const { flowToScreenPosition, getInternalNode, screenToFlowPosition, getViewport, setViewport } =
		useSvelteFlow();

	/** @type {HTMLCanvasElement | null} */
	let canvas = $state(null);
	/** @type {CanvasRenderingContext2D | null} */
	let ctx = $state(null);
	/** @type {Record<string, {center: number[], corners: number[][]}>} */
	let nodePoints = $state({});
	/** @type {number[][]} */
	let points = $state([]);
	let selectedNodeIds = $state(new Set());

	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let viewportStart = $state({ x: 0, y: 0, zoom: 1 });

	/** @param {PointerEvent} e */
	function handlePointerDown(e) {
		const target = /** @type {HTMLCanvasElement} */ (e.target);

		if (e.button === 1) {
			e.preventDefault();
			isPanning = true;
			panStart = { x: e.clientX, y: e.clientY };
			viewportStart = getViewport();
			target.setPointerCapture(e.pointerId);
			return;
		}

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

	/** @param {PointerEvent} e */
	function handlePointerMove(e) {
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

		const target = /** @type {HTMLCanvasElement} */ (e.target);
		const rect = target.getBoundingClientRect();
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
				for (const point of nodeData.corners) {
					const screenPos = flowToScreenPosition({ x: point[0], y: point[1] });
					const canvasRect = target.getBoundingClientRect();
					const canvasX = screenPos.x - canvasRect.left;
					const canvasY = screenPos.y - canvasRect.top;
					if (ctx.isPointInPath(path, canvasX, canvasY)) {
						nodesToSelect.add(nodeId);
						break;
					}
				}
			} else {
				const center = nodeData.center;
				const screenPos = flowToScreenPosition({ x: center[0], y: center[1] });
				const canvasRect = target.getBoundingClientRect();
				const canvasX = screenPos.x - canvasRect.left;
				const canvasY = screenPos.y - canvasRect.top;
				if (ctx.isPointInPath(path, canvasX, canvasY)) {
					nodesToSelect.add(nodeId);
				}
			}
		}

		selectedNodeIds = nodesToSelect;

		nodes.update((nodes) =>
			nodes.map((node) => ({
				...node,
				selected: nodesToSelect.has(node.id)
			}))
		);
	}

	/** @param {PointerEvent} e */
	function handlePointerUp(e) {
		const target = /** @type {HTMLCanvasElement} */ (e.target);

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

		if (onSelectionChange) {
			onSelectionChange(Array.from(selectedNodeIds));
		}
	}

	/**
	 * Zooms the viewport toward the cursor position on mouse wheel.
	 * @param {WheelEvent} e
	 */
	function handleWheel(e) {
		e.preventDefault();

		const { x: viewportX, y: viewportY, zoom } = getViewport();

		const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
		const newZoom = Math.max(store.minZoom, Math.min(store.maxZoom, zoom * zoomFactor));

		// Get mouse position relative to the canvas
		const rect = /** @type {HTMLCanvasElement} */ (e.currentTarget).getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const flowX = (mouseX - viewportX) / zoom;
		const flowY = (mouseY - viewportY) / zoom;

		const newViewportX = mouseX - flowX * newZoom;
		const newViewportY = mouseY - flowY * newZoom;

		setViewport({ x: newViewportX, y: newViewportY, zoom: newZoom }, { duration: 0 });
	}

	/**
	 * Deselects all nodes and notifies the parent via the onSelectionChange callback.
	 */
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
