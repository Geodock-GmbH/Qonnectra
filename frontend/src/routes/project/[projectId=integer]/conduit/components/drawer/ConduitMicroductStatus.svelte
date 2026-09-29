<script lang="ts">
	import type { Microduct } from '$lib/remote/conduit/microduct-data';

	import { m } from '$lib/paraglide/messages';

	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import {
		getMicroducts,
		getMicroductStatusOptions,
		updateMicroductStatus
	} from '$lib/remote/conduit/microducts.remote';

	let { conduitUuid }: { conduitUuid: string } = $props();

	const statusOptions = await getMicroductStatusOptions();

	// Server truth: the status command refreshes this query in-flight.
	const microducts = $derived(await getMicroducts(conduitUuid));

	/**
	 * Sets or clears a microduct's status.
	 * @param microduct - The microduct being changed.
	 * @param statusId - The new status id, or `null` for healthy.
	 */
	async function handleStatusChange(microduct: Microduct, statusId: number | null) {
		try {
			await updateMicroductStatus({ uuid: microduct.uuid, conduitUuid, statusId });
			globalToaster.success({ title: m.message_status_updated(), duration: 3000 });
		} catch {
			globalToaster.error({ title: m.message_status_update_failed(), duration: 5000 });
		}
	}
</script>

<MicroductsDisplayTable
	{microducts}
	showStatus={true}
	editableStatus={true}
	{statusOptions}
	onStatusChange={handleStatusChange}
/>
