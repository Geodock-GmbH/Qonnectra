<script lang="ts">
	import type { CableDrawerProps } from '$lib/types/attributeCardTypes';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { getSchemaState } from '$lib/context/networkSchemaContext';
	import {
		deleteCableSplicesAtNode,
		getCableSplicesAtNode,
		updateCableConnection
	} from '$lib/remote/network-schema/cable-connections.remote';
	import { updateCable } from '$lib/remote/network-schema/cables.remote';

	interface SchemaFlowNode {
		id: string;
		data?: { node?: { name?: string } };
	}

	const schemaState = getSchemaState();

	let cable = $derived($drawerStore.props as CableDrawerProps | undefined);
	let handleStart = $state('top');
	let handleEnd = $state('top');

	let selectedNodeStart = $state<string[]>([]);
	let selectedNodeEnd = $state<string[]>([]);

	// Nodes are sourced from schemaState context so child-view filtering is respected
	const availableNodes = $derived(
		((schemaState?.nodes as SchemaFlowNode[] | undefined) || []).map((node: SchemaFlowNode) => ({
			value: node.id,
			label: node.data?.node?.name || node.id
		}))
	);

	let pendingNodeChange = $state<{
		side: 'start' | 'end';
		newNodeId: string;
		spliceCount: number;
	} | null>(null);
	let confirmMessageBox: ReturnType<typeof MessageBox> | null = $state(null);

	$effect(() => {
		if (cable) {
			handleStart = cable.handle_start || 'top';
			handleEnd = cable.handle_end || 'top';
			selectedNodeStart = cable.uuid_node_start ? [cable.uuid_node_start] : [];
			selectedNodeEnd = cable.uuid_node_end ? [cable.uuid_node_end] : [];
		}
	});

	const handleOptions = [
		{ label: m.form_top(), value: 'top' },
		{ label: m.form_right(), value: 'right' },
		{ label: m.form_bottom(), value: 'bottom' },
		{ label: m.form_left(), value: 'left' }
	];

	/**
	 * Checks for existing fiber splices at the current node before switching the connection.
	 * Opens a confirmation dialog if splices would be lost.
	 */
	async function handleNodeChange(side: 'start' | 'end', newNodeId: string) {
		const currentNodeId = side === 'start' ? cable?.uuid_node_start : cable?.uuid_node_end;

		if (!newNodeId || newNodeId === currentNodeId) {
			return;
		}

		try {
			const splices = await getCableSplicesAtNode({
				cableUuid: cable?.uuid ?? '',
				nodeUuid: currentNodeId ?? ''
			});
			const spliceCount = splices.length;

			if (spliceCount > 0) {
				pendingNodeChange = { side, newNodeId, spliceCount };
				confirmMessageBox?.open();
			} else {
				await executeNodeChange(side, newNodeId);
			}
		} catch (err) {
			console.error('Error checking splices:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error checking splices',
				extraData: {
					from: 'CableDiagramEdgeHandleConfig.handleNodeChange',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			await executeNodeChange(side, newNodeId);
		}
	}

	/**
	 * Execute the node connection change
	 */
	async function executeNodeChange(side: 'start' | 'end', newNodeId: string) {
		try {
			await updateCableConnection({
				cableId: cable?.uuid ?? '',
				nodeStartId: side === 'start' ? newNodeId : undefined,
				nodeEndId: side === 'end' ? newNodeId : undefined,
				handleStart: side === 'start' ? handleStart : undefined,
				handleEnd: side === 'end' ? handleEnd : undefined
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});

			if (cable?.uuid) {
				schemaState.updateEdgeConnection(
					cable.uuid,
					side,
					newNodeId,
					side === 'start' ? handleStart : handleEnd
				);
			}

			// Update drawer props so subsequent saves use correct IDs
			const newNodeName = availableNodes.find((n) => n.value === newNodeId)?.label || newNodeId;
			if (side === 'start') {
				drawerStore.updateProps({
					uuid_node_start: newNodeId,
					uuid_node_start_name: newNodeName
				});
			} else {
				drawerStore.updateProps({
					uuid_node_end: newNodeId,
					uuid_node_end_name: newNodeName
				});
			}
		} catch (error) {
			console.error('Error updating cable connection:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating cable connection',
				extraData: {
					from: 'CableDiagramEdgeHandleConfig.executeNodeChange',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_cable()
			});
			// Restore the combobox to the persisted node since the change failed.
			if (side === 'start') {
				selectedNodeStart = cable?.uuid_node_start ? [cable.uuid_node_start] : [];
			} else {
				selectedNodeEnd = cable?.uuid_node_end ? [cable.uuid_node_end] : [];
			}
		}

		pendingNodeChange = null;
	}

	/**
	 * Handle handle position form submission
	 */
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!cable?.uuid) return;
		const cableUuid = cable.uuid;

		try {
			await updateCable({ cableId: cableUuid, handleStart, handleEnd });

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});

			schemaState.updateCableHandles(cableUuid, handleStart, handleEnd);
		} catch (error) {
			console.error('Error updating cable handles:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating cable handles',
				extraData: {
					from: 'CableDiagramEdgeHandleConfig.handleSubmit',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_cable()
			});
		}
	}

	async function handleConfirmNodeChange() {
		if (pendingNodeChange && cable?.uuid) {
			const oldNodeId =
				pendingNodeChange.side === 'start' ? cable.uuid_node_start : cable.uuid_node_end;

			try {
				await deleteCableSplicesAtNode({
					cableUuid: cable.uuid,
					nodeUuid: oldNodeId ?? ''
				});
			} catch (err) {
				console.error('Error deleting splices:', err);
				void logToBackendClient({
					level: 'ERROR',
					message: 'Error deleting splices',
					extraData: {
						from: 'CableDiagramEdgeHandleConfig.handleConfirmNodeChange',
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined
					}
				});
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_deleting_splices?.() || 'Failed to delete fiber connections'
				});
				handleCancelNodeChange();
				return;
			}

			await executeNodeChange(pendingNodeChange.side, pendingNodeChange.newNodeId);
		}
	}

	function handleCancelNodeChange() {
		if (pendingNodeChange?.side === 'start') {
			selectedNodeStart = cable?.uuid_node_start ? [cable.uuid_node_start] : [];
		} else if (pendingNodeChange?.side === 'end') {
			selectedNodeEnd = cable?.uuid_node_end ? [cable.uuid_node_end] : [];
		}
		pendingNodeChange = null;
	}
</script>

<form id="handle-config-form" class="flex flex-col gap-6" onsubmit={handleSubmit}>
	<div class="space-y-3">
		<h3 class="text-lg font-semibold">
			{cable?.uuid_node_start_name || cable?.uuid_node_start || m.common_unknown()}
		</h3>

		<div class="space-y-2">
			<label for="node-start" class="text-sm font-medium"
				>{m.form_change_node?.() || 'Change Node'}</label
			>
			<GenericCombobox
				data={availableNodes}
				bind:value={selectedNodeStart}
				defaultValue={selectedNodeStart}
				placeholder={m.placeholder_select_node?.() || 'Select node...'}
				onValueChange={(e) => {
					const newNodeId = e.value?.[0];
					if (newNodeId && newNodeId !== cable?.uuid_node_start) {
						handleNodeChange('start', newNodeId);
					}
				}}
				renderInPlace={true}
				placeholderSize="w-full size-10"
			/>
		</div>

		<div class="space-y-2">
			<label for="handle-start" class="text-sm font-medium"
				>{m.form_handle_position?.() || 'Handle Position'}</label
			>
			<div class="space-y-2">
				{#each handleOptions as option}
					<label class="flex items-center space-x-2">
						<input
							class="radio"
							type="radio"
							name="handle-start"
							value={option.value}
							checked={handleStart === option.value}
							onchange={() => (handleStart = option.value)}
						/>
						<p class="text-sm">{option.label}</p>
					</label>
				{/each}
			</div>
		</div>
	</div>

	<hr class="border-surface-300-700" />

	<div class="space-y-3">
		<h3 class="text-lg font-semibold">
			{cable?.uuid_node_end_name || cable?.uuid_node_end || m.common_unknown()}
		</h3>

		<div class="space-y-2">
			<label for="node-end" class="text-sm font-medium"
				>{m.form_change_node?.() || 'Change Node'}</label
			>
			<GenericCombobox
				data={availableNodes}
				bind:value={selectedNodeEnd}
				defaultValue={selectedNodeEnd}
				placeholder={m.placeholder_select_node?.() || 'Select node...'}
				onValueChange={(e) => {
					const newNodeId = e.value?.[0];
					if (newNodeId && newNodeId !== cable?.uuid_node_end) {
						handleNodeChange('end', newNodeId);
					}
				}}
				renderInPlace={true}
				placeholderSize="w-full size-10"
			/>
		</div>

		<div class="space-y-2">
			<label for="handle-end" class="text-sm font-medium"
				>{m.form_handle_position?.() || 'Handle Position'}</label
			>
			<div class="space-y-2">
				{#each handleOptions as option}
					<label class="flex items-center space-x-2">
						<input
							class="radio"
							type="radio"
							name="handle-end"
							value={option.value}
							checked={handleEnd === option.value}
							onchange={() => (handleEnd = option.value)}
						/>
						<p>{option.label}</p>
					</label>
				{/each}
			</div>
		</div>
	</div>
</form>

<div class="mt-6 flex flex-col items-end justify-end gap-3">
	<button type="submit" form="handle-config-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
</div>

<MessageBox
	bind:this={confirmMessageBox}
	heading={m.common_warning()}
	message={pendingNodeChange
		? `${m.message_confirm_reconnect_cable?.() || 'Changing the node connection will delete'} ${pendingNodeChange.spliceCount} ${m.form_fiber_connections?.() || 'fiber connections'}.`
		: ''}
	showAcceptButton={true}
	acceptText={m.common_continue?.() || 'Continue'}
	closeText={m.common_cancel()}
	onAccept={handleConfirmNodeChange}
/>
