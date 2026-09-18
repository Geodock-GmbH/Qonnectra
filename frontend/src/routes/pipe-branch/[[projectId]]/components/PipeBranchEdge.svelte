<script lang="ts">
	import type { BranchEdge } from './branchGraph';
	import type { EdgeProps } from '@xyflow/svelte';
	import { BaseEdge, getStraightPath } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import { deleteConnection, getConnections } from '$lib/remote/pipe-branch/connections.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { getPipeBranchState } from './PipeBranchState.svelte';

	let { id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<BranchEdge> = $props();

	const branch = getPipeBranchState();

	// Reverse Position.Right/Left offsets (12px each) to connect at handle centers
	const centeredSourceX = $derived(sourceX - 12);
	const centeredTargetX = $derived(targetX + 12);

	let [edgePath] = $derived(
		getStraightPath({
			sourceX: centeredSourceX,
			sourceY,
			targetX: centeredTargetX,
			targetY
		})
	);

	const connectionUuid = $derived(data?.uuid ?? null);

	const labelX = $derived((centeredSourceX + centeredTargetX) / 2);
	const labelY = $derived((sourceY + targetY) / 2 - 20);

	/** Deletes the connection; the edge leaves the canvas at once and returns if the backend refuses. */
	async function handleDeleteEdge() {
		const uuid = connectionUuid;
		const nodeUuid = branch.nodeUuid;
		if (!uuid || !nodeUuid) return;

		try {
			await deleteConnection({ uuid, nodeUuid }).updates(
				getConnections(nodeUuid).withOverride((saved) =>
					saved.filter((connection) => connection.uuid !== uuid)
				)
			);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_connection_deleted_successfully()
			});
		} catch (error) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error deleting connection',
				extraData: {
					from: 'PipeBranchEdge.handleDeleteEdge',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_connection_deleted()
			});
		}
	}
</script>

<!-- Dashed while the connection is still being saved. -->
<BaseEdge
	{id}
	path={edgePath}
	style="stroke: var(--color-surface-950-50); stroke-width: 2;{connectionUuid
		? ''
		: ' stroke-dasharray: 6 4;'}"
/>

{#if connectionUuid && data}
	<foreignObject x={labelX - 60} y={labelY} width="180" height="50" style="z-index: 100;">
		<div class="flex items-center gap-2" style="z-index: 100;">
			<div
				class="z-10 bg-surface-50-950 border border-surface-200-700 rounded px-2 py-1 text-xs text-center shadow-sm font-medium"
			>
				{data.sourceHandleData.microductNumber} ↔ {data.targetHandleData.microductNumber}
			</div>
			<button
				type="button"
				class="nodrag nopan bg-error-500 hover:bg-error-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm"
				onclick={handleDeleteEdge}
				aria-label={m.tooltip_delete_connection()}
				{@attach tooltip(m.tooltip_delete_connection())}
			>
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="3"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	</foreignObject>
{/if}
