<script lang="ts">
	import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
	import { useNodes } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { getConnections } from '$lib/remote/pipe-branch/connections.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { getPipeBranchState } from '../PipeBranchState.svelte';
	import LassoModeSwitch from './LassoModeSwitch.svelte';
	import { matchingMicroductPairs, toBranchNodes } from '../branchGraph';
	import { connectMicroducts } from '../connectMicroducts';

	const branch = getPipeBranchState();
	const nodes = useNodes();

	function deselectCanvasNodes() {
		nodes.update((current) => current.map((node) => ({ ...node, selected: false })));
	}

	/** Empties the lasso selection and deselects its nodes on the canvas. */
	function clearSelection() {
		branch.lassoSelection = [];
		deselectCanvasNodes();
	}

	/**
	 * Turns the lasso on or off; turning it off also deselects what it had selected.
	 * @param event - Change event of the lasso switch.
	 */
	function handleLassoModeChange(event: { checked: boolean }) {
		branch.setLassoMode(event.checked);
		if (!event.checked) deselectCanvasNodes();
	}

	/**
	 * Reads the node's connections, so auto-connect can skip microducts that are already joined.
	 * @param nodeUuid - Pipe-branch node on the canvas.
	 * @returns The connections, or `null` after reporting that they could not be read.
	 */
	async function existingConnections(nodeUuid: string): Promise<BranchConnection[] | null> {
		try {
			return await getConnections(nodeUuid);
		} catch (error) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_failed_to_create_connections()
			});
			return null;
		}
	}

	/** Connects all microducts that share a number between the two lasso-selected conduits. */
	async function autoConnectSelectedNodes() {
		const [sourceId, targetId] = branch.lassoSelection;
		const canvasNodes = toBranchNodes(branch.canvasTrenches);
		const source = canvasNodes.find((node) => node.id === sourceId);
		const target = canvasNodes.find((node) => node.id === targetId);
		const nodeUuid = branch.nodeUuid;

		if (!nodeUuid || !source || !target) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_could_not_find_selected_nodes()
			});
			return;
		}

		const connections = await existingConnections(nodeUuid);
		if (!connections) return;

		const pairs = matchingMicroductPairs(source, target, connections);
		if (pairs.length === 0) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_no_matching_microducts()
			});
			return;
		}

		await connectMicroducts(nodeUuid, pairs);
	}
</script>

<LassoModeSwitch
	checked={branch.lassoMode}
	onCheckedChange={handleLassoModeChange}
	partial={branch.partialSelection}
	onPartialChange={(partial) => (branch.partialSelection = partial)}
/>

{#if branch.lassoMode && branch.lassoSelection.length > 0}
	<div class="space-y-2">
		<div class="text-sm text-surface-600-300">
			{m.common_selected()}: {branch.lassoSelection.length}
			{m.form_node()}
		</div>

		{#if branch.lassoSelection.length === 2}
			<button
				type="button"
				class="btn btn-sm preset-filled-primary-500"
				onclick={autoConnectSelectedNodes}
			>
				{m.action_connect_selected_nodes()}
			</button>
		{:else if branch.lassoSelection.length > 2}
			<div class="text-xs text-warning-500">{m.form_select_exactly_2_nodes()}</div>
		{/if}

		<button type="button" class="btn btn-sm preset-filled-warning-500" onclick={clearSelection}>
			{m.action_clear_selection()}
		</button>
	</div>
{/if}
