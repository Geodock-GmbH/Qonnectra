<script lang="ts">
	import type { Microduct } from '$lib/remote/conduit/microduct-data';

	import { m } from '$lib/paraglide/messages';

	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import { getMicroducts } from '$lib/remote/conduit/microducts.remote';
	import { removeNodeFromMicroduct } from '$lib/remote/house-connections/node-assignment.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { getHouseConnectionInteraction } from '../houseConnectionContext';

	let { conduitUuid }: { conduitUuid: string } = $props();

	const { nodeAssignment } = getHouseConnectionInteraction();

	const microducts = $derived(await getMicroducts(conduitUuid));

	let removing = $state<Record<string, boolean>>({});

	/**
	 * Disconnects the microduct from its node.
	 * @param microduct - The microduct to unassign
	 */
	async function handleRemoveClick(microduct: Microduct) {
		removing[microduct.uuid] = true;

		try {
			await removeNodeFromMicroduct({ microductUuid: microduct.uuid, conduitUuid });
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_unassigned_node()
			});
		} catch (err) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error removing node from microduct',
				extraData: {
					from: 'HouseConnectionMicroducts.handleRemoveClick',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_error_saving_data()
			});
		} finally {
			removing[microduct.uuid] = false;
		}
	}
</script>

<MicroductsDisplayTable {microducts} showStatus={true}>
	{#snippet actions(microduct)}
		<div class="flex gap-2">
			<button
				type="button"
				class="btn btn-sm preset-filled-primary-500"
				onclick={() => nodeAssignment.activateAssignMode(microduct.uuid, conduitUuid)}
				disabled={nodeAssignment.isAssignMode}
				aria-label={m.tooltip_assign_node_to_microduct()}
				{@attach tooltip(m.tooltip_assign_node_to_microduct())}
			>
				{m.action_assign()}
			</button>
			{#if microduct.uuid_node?.properties?.uuid_address?.properties}
				<button
					type="button"
					class="btn btn-sm preset-filled-error-500"
					onclick={() => handleRemoveClick(microduct)}
					disabled={nodeAssignment.isAssignMode || removing[microduct.uuid]}
					aria-label={m.tooltip_remove_node_from_microduct()}
					{@attach tooltip(m.tooltip_remove_node_from_microduct())}
				>
					{m.action_unassign()}
				</button>
			{/if}
		</div>
	{/snippet}
</MicroductsDisplayTable>
