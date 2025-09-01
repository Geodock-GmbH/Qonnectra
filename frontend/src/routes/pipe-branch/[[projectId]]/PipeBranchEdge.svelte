<script>
	import { BaseEdge, getStraightPath } from '@xyflow/svelte';

	let { id, sourceX, sourceY, targetX, targetY, data } = $props();

	// Debug the edge data
	console.log('Edge data for', id, ':', data);

	let [edgePath] = $derived(
		getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY
		})
	);

	// Connection details from data
	const connectionUuid = $derived(data?.uuid || null);
	const sourceHandleData = $derived(data?.sourceHandleData || {});
	const targetHandleData = $derived(data?.targetHandleData || {});
	const isConnected = $derived(!!connectionUuid);

	// Edge label position
	const labelX = $derived((sourceX + targetX) / 2);
	const labelY = $derived((sourceY + targetY) / 2 - 10);
</script>

<BaseEdge
	{id}
	path={edgePath}
	style="stroke: {isConnected
		? 'var(--color-success-500)'
		: 'var(--color-surface-400)'}; stroke-width: 2;"
/>

<!-- Connection label -->
{#if isConnected && (sourceHandleData.microductNumber || targetHandleData.microductNumber)}
	<foreignObject x={labelX - 40} y={labelY - 40} width="80" height="40">
		<div
			class="bg-surface-50-950 border border-surface-200-700 rounded px-2 py-1 text-xs text-center shadow-sm"
			title="Connected: {sourceHandleData.conduitName} MD{sourceHandleData.microductNumber} → {targetHandleData.conduitName} MD{targetHandleData.microductNumber}"
		>
			MD{sourceHandleData.microductNumber}→{targetHandleData.microductNumber}
		</div>
	</foreignObject>
{/if}
