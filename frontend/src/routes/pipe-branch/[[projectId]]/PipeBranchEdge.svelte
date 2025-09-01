<script>
	// Skeleton
	import { createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// SvelteFlow
	import { BaseEdge, getStraightPath, useEdges, EdgeLabel } from '@xyflow/svelte';

	let { id, sourceX, sourceY, targetX, targetY, data } = $props();

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// Use the edges store for deletion
	const edges = useEdges();

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

	// Handle edge deletion
	async function handleDeleteEdge() {
		console.log('Deleting edge with ID:', id, 'and UUID:', connectionUuid);

		// First delete from backend if it has a UUID
		if (connectionUuid) {
			try {
				const response = await fetch(`/api/microduct-connections/?uuid=${connectionUuid}`, {
					method: 'DELETE'
				});

				if (!response.ok) {
					let error;
					try {
						error = await response.json();
					} catch (_) {
						error = await response.text();
					}
					console.error('Failed to delete connection:', error);
					toaster.create({
						type: 'error',
						title: m.error(),
						description: m.connection_deleted_error()
					});
					return;
				}

				toaster.success({
					title: m.title_login_success(),
					description: m.connection_deleted_successfully()
				});
				console.log('Successfully deleted connection from backend');
			} catch (error) {
				console.error('Error deleting connection:', error);
				toaster.create({
					type: 'error',
					title: m.error(),
					description: m.connection_deleted_error()
				});
				return;
			}
		}

		// Then remove from UI
		edges.update((eds) => eds.filter((edge) => edge.id !== id));
	}
</script>

<Toaster {toaster}></Toaster>

<BaseEdge
	{id}
	path={edgePath}
	style="stroke: {isConnected
		? 'var(--color-success-500)'
		: 'var(--color-surface-400)'}; stroke-width: 2;"
/>

<!-- Connection label -->
{#if isConnected && (sourceHandleData.microductNumber || targetHandleData.microductNumber)}
	<foreignObject x={labelX - 50} y={labelY - 40} width="100" height="40" style="z-index: 100;">
		<div class="flex items-center gap-1" style="z-index: 100;">
			<div
				class="z-10 bg-surface-50-950 border border-surface-200-700 rounded px-2 py-1 text-xs text-center shadow-sm"
				title="Connected: {sourceHandleData.conduitName} MD{sourceHandleData.microductNumber} → {targetHandleData.conduitName} MD{targetHandleData.microductNumber}"
			>
				MD{sourceHandleData.microductNumber}→{targetHandleData.microductNumber}
			</div>
			<button
				class="nodrag nopan bg-error-500 hover:bg-error-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-sm"
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
				toaster.promise(handleDeleteEdge(), {
					success: () => ({
						title: m.title_login_success(),
						description: m.connection_deleted_successfully()
					}),
					error: () => ({
						title: m.error(),
						description: m.connection_deleted_error()
					})
				})}
			title="Delete edge"
		>
			×
		</button>
	</EdgeLabel>
{/if}
