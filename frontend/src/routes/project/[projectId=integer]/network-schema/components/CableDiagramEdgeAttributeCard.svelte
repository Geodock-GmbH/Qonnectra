<script lang="ts">
	import type { AttributeOptions, CableDrawerProps } from '$lib/types/attributeCardTypes';
	import { getContext } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import {
		deleteCable as deleteCableCommand,
		getCableSplices,
		getConduitsForCable
	} from '$lib/remote/network-schema/cables.remote';

	import CableAttributeForm from './CableAttributeForm.svelte';

	const attributes = getContext<AttributeOptions>('attributeOptions') || {
		cableTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: []
	};

	let {
		onLabelUpdate,
		onEdgeDelete,
		onSaveComplete = () => {}
	}: {
		onLabelUpdate?: (name: string) => void;
		onEdgeDelete?: (uuid: string) => void;
		onSaveComplete?: () => void | Promise<void>;
	} = $props();

	let messageBoxConfirm = $state<ReturnType<typeof MessageBox> | null>(null);
	let cable = $derived($drawerStore.props as CableDrawerProps | undefined);
	let fiberCount = $derived<number>(
		Number(cable?.cable_type?.fiber_count ?? cable?.fiber_count ?? 0) || 0
	);
	let connectedSpliceCount = $state(0);

	// Connected conduits are server truth rendered read-only; the query re-runs
	// per cable and its reactive `.current` feeds the form without an effect.
	const conduitsQuery = $derived(cable?.uuid ? getConduitsForCable(cable.uuid) : undefined);
	const connectedConduits = $derived((conduitsQuery?.current ?? []).join(', '));

	async function confirmDelete() {
		if (!cable?.uuid) return;

		try {
			const splices = await getCableSplices(cable.uuid);
			connectedSpliceCount = splices.length;
		} catch (err) {
			console.error('Error checking cable splices:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error checking cable splices',
				extraData: {
					from: 'CableDiagramEdgeAttributeCard.confirmDelete',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			connectedSpliceCount = 0;
		}

		messageBoxConfirm?.open();
	}

	async function handleDelete() {
		if (!cable?.uuid) return;

		try {
			await deleteCableCommand(cable.uuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_cable()
			});
			drawerStore.close();
			onEdgeDelete?.(cable.uuid);
		} catch (error) {
			console.error('Error deleting cable:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error deleting cable',
				extraData: {
					from: 'CableDiagramEdgeAttributeCard.handleDelete',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description:
					(error instanceof Error ? error.message : null) || m.message_error_deleting_cable()
			});
		}
	}
</script>

<!-- Cable form (keyed so a different cable remounts and re-initialises fields) -->
{#key cable?.uuid}
	{#if cable}
		<CableAttributeForm {cable} {attributes} {connectedConduits} {onLabelUpdate} {onSaveComplete} />
	{/if}
{/key}

<!-- Delete and update buttons -->
<div
	class="sticky bottom-0 mt-6 mr-4 flex flex-col items-end justify-end gap-3 bg-surface-50-950 pb-2 pt-4"
>
	<button type="submit" form="cable-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
	<button type="button" onclick={confirmDelete} class="btn preset-filled-error-500 w-full">
		{m.action_delete_cable()}
	</button>
</div>

<!-- Delete confirmation modal -->
<MessageBox
	bind:this={messageBoxConfirm}
	heading={m.common_confirm()}
	message={connectedSpliceCount > 0
		? `${m.message_confirm_delete_cable()} ${connectedSpliceCount} ${m.form_fibers?.() || 'fibers'} ${m.common_connected_to_ports?.() || 'connected to ports'}.`
		: fiberCount > 0
			? `${m.message_confirm_delete_cable()} ${m.form_fibers?.() || 'Fibers'}: ${fiberCount}`
			: m.message_confirm_delete_cable()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={handleDelete}
/>
