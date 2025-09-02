<script>
	import { useSvelteFlow, useStore, useNodes } from '@xyflow/svelte';
	import { getSvgPathFromStroke } from './lassoUtils.js';

	let { partial = false, onSelectionChange } = $props();

	const nodes = useNodes();
	const store = useStore();
	const { flowToScreenPosition, getInternalNode } = useSvelteFlow();

	let canvas = $state(null);
	let ctx = $state(null);
	let nodePoints = $state({});
	let points = $state([]);
	let selectedNodeIds = $state(new Set());

	function handlePointerDown(e) {
		const target = e.target;
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
			const nodeCorners = [
				[x, y],
				[x + width, y],
				[x + width, y + height],
				[x, y + height]
			];
			nodePoints[node.id] = nodeCorners;
		}

		ctx = canvas?.getContext('2d') || null;
		if (!ctx) return;
		ctx.lineWidth = 1;
		ctx.fillStyle = 'rgba(0, 89, 220, 0.08)';
		ctx.strokeStyle = 'rgba(0, 89, 220, 0.8)';
	}

	function handlePointerMove(e) {
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

		for (const [nodeId, nodeCorners] of Object.entries(nodePoints)) {
			if (partial) {
				// Partial selection: select node if any point is in the path
				for (const point of nodeCorners) {
					const screenPos = flowToScreenPosition({ x: point[0], y: point[1] });
					const rect = e.target.getBoundingClientRect();
					const canvasX = screenPos.x - rect.left;
					const canvasY = screenPos.y - rect.top;
					if (ctx.isPointInPath(path, canvasX, canvasY)) {
						nodesToSelect.add(nodeId);
						break;
					}
				}
			} else {
				// Full selection: select node only if all points are in the path
				let allPointsInPath = true;
				for (const point of nodeCorners) {
					const screenPos = flowToScreenPosition({ x: point[0], y: point[1] });
					const rect = e.target.getBoundingClientRect();
					const canvasX = screenPos.x - rect.left;
					const canvasY = screenPos.y - rect.top;
					if (!ctx.isPointInPath(path, canvasX, canvasY)) {
						allPointsInPath = false;
						break;
					}
				}
				if (allPointsInPath) {
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
