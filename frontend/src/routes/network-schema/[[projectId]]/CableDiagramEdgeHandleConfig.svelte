<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import type { CableDrawerProps } from '$lib/types/attributeCardTypes';
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { actionData } from '$lib/types/attributeCardTypes';

	interface SchemaFlowNode {
		id: string;
		data?: { node?: { name?: string } };
	}

	const schemaStateContext = getContext<{ nodes: SchemaFlowNode[] } | undefined>('schemaState');

	let cable = $derived($drawerStore.props as CableDrawerProps | undefined);
	let handleStart = $state('top');
	let handleEnd = $state('top');

	let selectedNodeStart = $state<string[]>([]);
	let selectedNodeEnd = $state<string[]>([]);

	// Nodes are sourced from schemaState context so child-view filtering is respected
	const availableNodes = $derived(
		(schemaStateContext?.nodes || []).map((node: SchemaFlowNode) => ({
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

		const formData = new FormData();
		formData.append('cableUuid', cable?.uuid ?? '');
		formData.append('nodeUuid', currentNodeId ?? '');

		try {
			const response = await fetch('?/getCableSplicesAtNode', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text()) as ActionResult;
			const spliceCount = (actionData(result)?.splices as unknown[] | undefined)?.length || 0;

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
		const formData = new FormData();
		formData.append('uuid', cable?.uuid ?? '');

		if (side === 'start') {
			formData.append('uuid_node_start_id', newNodeId);
			formData.append('handle_start', handleStart);
		} else {
			formData.append('uuid_node_end_id', newNodeId);
			formData.append('handle_end', handleEnd);
		}

		try {
			const response = await fetch('?/updateCableConnection', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text()) as ActionResult;

			if (result.type === 'failure' || result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				if (side === 'start') {
					selectedNodeStart = cable?.uuid_node_start ? [cable.uuid_node_start] : [];
				} else {
					selectedNodeEnd = cable?.uuid_node_end ? [cable.uuid_node_end] : [];
				}
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});

			const oldNodeId = side === 'start' ? cable?.uuid_node_start : cable?.uuid_node_end;
			window.dispatchEvent(
				new CustomEvent('cableConnectionChanged', {
					detail: {
						cableId: cable?.uuid,
						side,
						oldNodeId,
						newNodeId,
						handlePosition: side === 'start' ? handleStart : handleEnd
					}
				})
			);

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
		const formData = new FormData();
		formData.append('uuid', cableUuid);
		formData.append('handle_start', handleStart);
		formData.append('handle_end', handleEnd);

		try {
			const response = await fetch('?/updateCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			if (result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});

			window.dispatchEvent(
				new CustomEvent('updateCableHandles', {
					detail: {
						cableId: cableUuid,
						handleStart: handleStart,
						handleEnd: handleEnd
					}
				})
			);
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
				title: m.message_error_updating_cable()
			});
		}
	}

	async function handleConfirmNodeChange() {
		if (pendingNodeChange && cable?.uuid) {
			const oldNodeId =
				pendingNodeChange.side === 'start' ? cable.uuid_node_start : cable.uuid_node_end;

			try {
				const deleteFormData = new FormData();
				deleteFormData.append('cableUuid', cable.uuid);
				deleteFormData.append('nodeUuid', oldNodeId ?? '');

				const deleteResponse = await fetch('?/deleteCableSplicesAtNode', {
					method: 'POST',
					body: deleteFormData
				});

				const deleteResult = deserialize(await deleteResponse.text());

				if (deleteResult.type === 'failure' || deleteResult.type === 'error') {
					globalToaster.error({
						title: m.common_error(),
						description:
							m.message_error_deleting_splices?.() || 'Failed to delete fiber connections'
					});
					handleCancelNodeChange();
					return;
				}
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
