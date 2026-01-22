<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	let cable = $derived($drawerStore.props);
	let handleStart = $state('top');
	let handleEnd = $state('top');

	// Node selection state
	let selectedNodeStart = $state([]);
	let selectedNodeEnd = $state([]);
	let availableNodes = $state([]);
	let loadingNodes = $state(false);

	// Pending node change for confirmation
	let pendingNodeChange = $state(null);
	let confirmMessageBox;

	// Initialize state from cable data
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

	// Fetch available nodes on mount
	onMount(async () => {
		await fetchAvailableNodes();
	});

	async function fetchAvailableNodes() {
		loadingNodes = true;
		try {
			const response = await fetch('?/getAllNodes', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());
			if (result.data?.nodes) {
				availableNodes = result.data.nodes;
			}
		} catch (err) {
			console.error('Error fetching nodes:', err);
		} finally {
			loadingNodes = false;
		}
	}

	/**
	 * Handle node change request - checks for splices first
	 */
	async function handleNodeChange(side, newNodeId) {
		const currentNodeId = side === 'start' ? cable.uuid_node_start : cable.uuid_node_end;

		if (!newNodeId || newNodeId === currentNodeId) {
			return;
		}

		// Check for splices at old node
		const formData = new FormData();
		formData.append('cableUuid', cable.uuid);
		formData.append('nodeUuid', currentNodeId);

		try {
			const response = await fetch('?/getCableSplicesAtNode', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());
			const spliceCount = result.data?.splices?.length || 0;

			if (spliceCount > 0) {
				pendingNodeChange = { side, newNodeId, spliceCount };
				confirmMessageBox.open();
			} else {
				await executeNodeChange(side, newNodeId);
			}
		} catch (err) {
			console.error('Error checking splices:', err);
			// Proceed without warning if check fails
			await executeNodeChange(side, newNodeId);
		}
	}

	/**
	 * Execute the node connection change
	 */
	async function executeNodeChange(side, newNodeId) {
		const formData = new FormData();
		formData.append('uuid', cable.uuid);

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

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				// Reset selection to original value
				if (side === 'start') {
					selectedNodeStart = cable.uuid_node_start ? [cable.uuid_node_start] : [];
				} else {
					selectedNodeEnd = cable.uuid_node_end ? [cable.uuid_node_end] : [];
				}
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});

			// Dispatch event to update diagram
			const oldNodeId = side === 'start' ? cable.uuid_node_start : cable.uuid_node_end;
			window.dispatchEvent(
				new CustomEvent('cableConnectionChanged', {
					detail: {
						cableId: cable.uuid,
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
	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData();
		formData.append('uuid', cable.uuid);
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
						cableId: cable.uuid,
						handleStart: handleStart,
						handleEnd: handleEnd
					}
				})
			);
		} catch (error) {
			console.error('Error updating cable handles:', error);
			globalToaster.error({
				title: m.message_error_updating_cable()
			});
		}
	}

	async function handleConfirmNodeChange() {
		if (pendingNodeChange) {
			// First delete the splices at the old node
			const oldNodeId =
				pendingNodeChange.side === 'start' ? cable.uuid_node_start : cable.uuid_node_end;

			try {
				const deleteFormData = new FormData();
				deleteFormData.append('cableUuid', cable.uuid);
				deleteFormData.append('nodeUuid', oldNodeId);

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
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_deleting_splices?.() || 'Failed to delete fiber connections'
				});
				handleCancelNodeChange();
				return;
			}

			// Now execute the node change
			await executeNodeChange(pendingNodeChange.side, pendingNodeChange.newNodeId);
		}
	}

	function handleCancelNodeChange() {
		// Reset selection to original value
		if (pendingNodeChange?.side === 'start') {
			selectedNodeStart = cable.uuid_node_start ? [cable.uuid_node_start] : [];
		} else if (pendingNodeChange?.side === 'end') {
			selectedNodeEnd = cable.uuid_node_end ? [cable.uuid_node_end] : [];
		}
		pendingNodeChange = null;
	}
</script>

<!-- Handle configuration form -->
<form id="handle-config-form" class="flex flex-col gap-6" onsubmit={handleSubmit}>
	<!-- Start Node Section -->
	<div class="space-y-3">
		<h3 class="text-lg font-semibold">
			{cable?.uuid_node_start_name || cable?.uuid_node_start || m.common_unknown()}
		</h3>

		<!-- Node Selection -->
		<div class="space-y-2">
			<label for="node-start" class="text-sm font-medium"
				>{m.form_change_node?.() || 'Change Node'}</label
			>
			{#if loadingNodes}
				<p class="text-sm text-surface-500">{m.common_loading()}</p>
			{:else}
				<GenericCombobox
					data={availableNodes}
					bind:value={selectedNodeStart}
					defaultValue={selectedNodeStart}
					placeholder={m.placeholder_select_node?.() || 'Select node...'}
					onValueChange={(e) => {
						const newNodeId = e.value?.[0];
						if (newNodeId && newNodeId !== cable.uuid_node_start) {
							handleNodeChange('start', newNodeId);
						}
					}}
				/>
			{/if}
		</div>

		<!-- Handle Position -->
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

	<!-- End Node Section -->
	<div class="space-y-3">
		<h3 class="text-lg font-semibold">
			{cable?.uuid_node_end_name || cable?.uuid_node_end || m.common_unknown()}
		</h3>

		<!-- Node Selection -->
		<div class="space-y-2">
			<label for="node-end" class="text-sm font-medium"
				>{m.form_change_node?.() || 'Change Node'}</label
			>
			{#if loadingNodes}
				<p class="text-sm text-surface-500">{m.common_loading()}</p>
			{:else}
				<GenericCombobox
					data={availableNodes}
					bind:value={selectedNodeEnd}
					defaultValue={selectedNodeEnd}
					placeholder={m.placeholder_select_node?.() || 'Select node...'}
					onValueChange={(e) => {
						const newNodeId = e.value?.[0];
						if (newNodeId && newNodeId !== cable.uuid_node_end) {
							handleNodeChange('end', newNodeId);
						}
					}}
				/>
			{/if}
		</div>

		<!-- Handle Position -->
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

<!-- Save button for handle positions -->
<div class="mt-6 flex flex-col items-end justify-end gap-3">
	<button type="submit" form="handle-config-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
</div>

<!-- Confirmation MessageBox for splice warning -->
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
