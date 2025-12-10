<script>
	import { getContext } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';

	let { microducts = [], loading = false, error = null, onMicroductUpdate = null } = $props();

	const nodeAssignmentManager = getContext('nodeAssignmentManager');
	const isAssignMode = $derived(nodeAssignmentManager?.isAssignMode || false);

	/**
	 * Handle the assign click event
	 * @param {Object} microduct - The microduct object
	 */
	function handleAssignClick(microduct) {
		if (!nodeAssignmentManager) {
			console.error('NodeAssignmentManager not found in context');
			return;
		}

		nodeAssignmentManager.activateAssignMode(microduct.uuid, (updatedData) => {
			if (onMicroductUpdate && updatedData?.microduct) {
				onMicroductUpdate(updatedData.microduct);
			}
		});
	}

	/**
	 * Handle the remove click event
	 * @param {Object} microduct - The microduct object
	 */
	function handleRemoveClick(microduct) {
		if (!nodeAssignmentManager) {
			console.error('NodeAssignmentManager not found in context');
			return;
		}

		nodeAssignmentManager.removeNodeFromMicroduct(microduct.uuid, (updatedData) => {
			if (onMicroductUpdate && updatedData?.microduct) {
				onMicroductUpdate(updatedData.microduct);
			}
		});
	}
</script>

<MicroductsDisplayTable {microducts} {loading} {error}>
	{#snippet actions(microduct)}
		<div class="flex gap-2">
			<button
				class="btn btn-sm preset-filled-primary-500"
				onclick={() => handleAssignClick(microduct)}
				disabled={isAssignMode}
				aria-label="Assign node to microduct"
			>
				{m.action_assign()}
			</button>
			{#if microduct.uuid_node?.properties?.uuid_address?.properties}
				<button
					class="btn btn-sm preset-filled-error-500"
					onclick={() => handleRemoveClick(microduct)}
					disabled={isAssignMode}
					aria-label="Remove node from microduct"
				>
					{m.action_unassign()}
				</button>
			{/if}
		</div>
	{/snippet}
</MicroductsDisplayTable>
