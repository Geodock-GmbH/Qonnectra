<script lang="ts">
	import type { TrenchesNearNodeTrench } from '$lib/types';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { getConnections } from '$lib/remote/pipe-branch/connections.remote';
	import {
		getTrenchesNearNode,
		getTrenchSelections,
		saveTrenchSelections
	} from '$lib/remote/pipe-branch/trench-selections.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { getPipeBranchState } from '../PipeBranchState.svelte';
	import TrenchSelector from './TrenchSelector.svelte';
	import { lockedConduitKeys, preselectedKeys } from '../branchGraph';

	const branch = getPipeBranchState();

	// The selector edits a snapshot; it is mounted anew every time it opens,
	// so the loads below run once per opening.
	const nearby = await getTrenchesNearNode({
		nodeName: branch.selectedBranch,
		projectId: branch.projectId
	});
	const [savedTrenchUuids, connections] = await Promise.all([
		getTrenchSelections(nearby.node_uuid),
		getConnections(nearby.node_uuid)
	]);

	const lockedKeys = lockedConduitKeys(connections, nearby.trenches);
	let selectedKeys = $state(preselectedKeys(nearby.trenches, savedTrenchUuids, lockedKeys));

	// The selector stays on screen until the canvas has loaded its connections.
	let confirmed = false;

	/**
	 * Loads the selection onto the canvas and remembers its trenches for the node.
	 * @param selectedTrenches - The selected trenches, holding only their selected conduits.
	 */
	async function handleConfirm(selectedTrenches: TrenchesNearNodeTrench[]) {
		if (confirmed) return;
		confirmed = true;

		branch.showOnCanvas(nearby.node_uuid, selectedTrenches);

		try {
			await saveTrenchSelections({
				nodeUuid: nearby.node_uuid,
				trenchUuids: selectedTrenches.map((trench) => trench.uuid)
			});
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_saving_trench_selections()
			});
		} catch (error) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving trench selections',
				extraData: {
					from: 'TrenchSelection.handleConfirm',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_saving_trench_selections()
			});
		}
	}
</script>

{#if nearby.trenches.length === 0}
	<div
		class="card preset-filled-surface-50-950 p-4 flex flex-col gap-4 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px]"
	>
		<p class="text-sm text-warning-500 bg-warning-500/10 p-2 rounded" role="status">
			{m.message_no_trenches_near_node()}
		</p>
		<button
			type="button"
			class="btn preset-outlined-surface-500"
			onclick={() => branch.cancelSelection()}
		>
			{m.common_back()}
		</button>
	</div>
{:else}
	<TrenchSelector
		trenches={nearby.trenches}
		bind:selectedKeys
		{lockedKeys}
		onConfirm={handleConfirm}
		onCancel={() => branch.cancelSelection()}
	/>
{/if}
