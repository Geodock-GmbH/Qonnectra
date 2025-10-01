<script>
	import { BaseEdge, getBezierPath } from '@xyflow/svelte';

	import { drawerStore } from '$lib/stores/drawer';

	let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = $props();

	// Calculate the bezier path for the edge
	let [edgePath, labelX, labelY] = $derived(
		getBezierPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition
		})
	);

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
</script>

<!-- Base edge -->
<BaseEdge
	{id}
	path={edgePath}
	style="stroke: var(--color-primary-500); stroke-width: 2;"
	aria-label="Open cable details for {data.label}"
/>

<!-- Custom label positioned in the middle -->
{#if data?.label}
	<foreignObject
		x={labelX - 150}
		y={labelY - 12}
		width="300"
		height="30"
		style="z-index: 100; cursor: pointer;"
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

<!-- Arrow marker definition -->
<svg style="position: absolute; top: 0; left: 0;">
	<defs>
		<marker
			id="arrow"
			viewBox="0 0 10 10"
			refX="8"
			refY="5"
			markerWidth="6"
			markerHeight="6"
			orient="auto-start-reverse"
		>
			<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary-500)" />
		</marker>
	</defs>
</svg>
