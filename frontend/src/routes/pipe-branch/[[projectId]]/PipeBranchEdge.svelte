<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { globalToaster } from '$lib/stores/toaster';

	// SvelteFlow
	import { BaseEdge, EdgeLabel, getStraightPath, useEdges } from '@xyflow/svelte';

	let { id, sourceX, sourceY, targetX, targetY, data } = $props();

	// Use the edges store for deletion
	const edges = useEdges();

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

	// Edge label position - offset more to avoid overlap with bigger nodes
	const labelX = $derived((sourceX + targetX) / 2);
	const labelY = $derived((sourceY + targetY) / 2 - 20);

	// Handle edge deletion
	async function handleDeleteEdge() {
		// First delete from backend if it has a UUID
		if (connectionUuid) {
			try {
				const formData = new FormData();
				formData.append('uuid', connectionUuid);
				const response = await fetch(`?/deleteConnection`, {
					method: 'POST',
					body: formData
				});

				if (!response.ok) {
					const error = await response.json();
					console.error('Failed to delete connection:', error);
					globalToaster.error({
						title: m.common_error(),
						description: m.message_error_connection_deleted()
					});
					return;
				}

				globalToaster.success({
					title: m.title_success(),
					description: m.message_connection_deleted_successfully()
				});
			} catch (error) {
				console.error('Error deleting connection:', error);
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_connection_deleted()
				});
				return;
			}
		}

		// Then remove from UI
		edges.update((eds) => eds.filter((edge) => edge.id !== id));
	}
</script>

<BaseEdge
	{id}
	path={edgePath}
	style="stroke: {isConnected
		? 'var(--color-surface-950-50)'
		: 'var(--color-surface-950-50)'}; stroke-width: 2;"
/>

<!-- Connection label -->
{#if isConnected && (sourceHandleData.microductNumber || targetHandleData.microductNumber)}
	<foreignObject x={labelX - 60} y={labelY - 0} width="180" height="50" style="z-index: 100;">
		<div class="flex items-center gap-2" style="z-index: 100;">
			<div
				class="z-10 bg-surface-50-950 border border-surface-200-700 rounded px-2 py-1 text-xs text-center shadow-sm font-medium"
				title="Connected: {sourceHandleData.conduitName} MD{sourceHandleData.microductNumber} → {targetHandleData.conduitName} MD{targetHandleData.microductNumber}"
			>
				{sourceHandleData.microductNumber} ↔ {targetHandleData.microductNumber}
			</div>
			<button
				class="nodrag nopan bg-error-500 hover:bg-error-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-sm"
				onclick={handleDeleteEdge}
				title="Delete connection"
			>
				×
			</button>
		</div>
	</foreignObject>
{/if}

<!-- Delete button for unconnected edges -->
{#if !isConnected}
	<EdgeLabel x={labelX} y={labelY}>
		<button
			class="nodrag nopan bg-error-500 hover:bg-error-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-sm"
			style="z-index: 100;"
			onclick={() =>
				globalToaster.promise(handleDeleteEdge(), {
					success: () => ({
						title: m.title_success(),
						description: m.message_connection_deleted_successfully()
					}),
					error: () => ({
						title: m.common_error(),
						description: m.message_error_connection_deleted()
					})
				})}
			title="Delete edge"
		>
			×
		</button>
	</EdgeLabel>
{/if}
