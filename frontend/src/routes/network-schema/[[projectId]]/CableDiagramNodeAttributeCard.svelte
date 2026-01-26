<script>
	import { deserialize } from '$app/forms';
	import { getContext } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { tooltip } from '$lib/utils/tooltip.js';

	const attributes = getContext('attributeOptions') || {
		nodeTypes: [],
		statuses: [],
		networkLevels: [],
		companies: [],
		flags: [],
		excludedNodeTypeIds: []
	};

	let node = $derived($drawerStore.props);
	let id = $derived(node?.id || '');
	let nodeName = $derived(node?.name || '');
	let nodeType = $derived([node?.node_type?.id]);
	let nodeStatus = $derived([node?.status?.id]);
	let nodeNetworkLevel = $derived([node?.network_level?.id]);
	let nodeOwner = $derived([node?.owner?.id]);
	let nodeConstructor = $derived([node?.constructor?.id]);
	let nodeManufacturer = $derived([node?.manufacturer?.id]);
	let nodeWarranty = $derived(node?.warranty || '');
	let nodeDate = $derived(node?.date || '');
	let nodeFlag = $derived([node?.flag?.id]);

	let { onLabelUpdate, onNodeDelete } = $props();

	// Delete confirmation state
	let deleteMessageBox = $state(null);
	let cableBlockedMessageBox = $state(null);
	let pendingDeleteCableCount = $state(0);
	let pendingDeleteStructureCount = $state(0);
	let hasConnectedCables = $state(false);
	let isCheckingDependencies = $state(false);

	// Track the last checked node to avoid race conditions
	let lastCheckedNodeId = $state('');

	// Check dependencies when node changes
	async function checkNodeDependencies(nodeId) {
		if (!nodeId) return;

		isCheckingDependencies = true;
		lastCheckedNodeId = nodeId;

		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeId);

			const response = await fetch('?/getNodeDependencies', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			const cables = result.data?.cables || [];
			const structures = result.data?.structures || [];

			// Only update state if this is still the current node
			if (lastCheckedNodeId === nodeId) {
				pendingDeleteCableCount = cables.length;
				pendingDeleteStructureCount = structures.length;
				hasConnectedCables = cables.length > 0;
			}
		} catch (err) {
			console.error('Error checking dependencies:', err);
			if (lastCheckedNodeId === nodeId) {
				hasConnectedCables = false;
			}
		} finally {
			if (lastCheckedNodeId === nodeId) {
				isCheckingDependencies = false;
			}
		}
	}

	// Reset and fetch dependencies when node changes
	$effect(() => {
		if (id) {
			// Reset state immediately
			pendingDeleteCableCount = 0;
			pendingDeleteStructureCount = 0;
			hasConnectedCables = false;
			// Fetch new dependencies
			checkNodeDependencies(id);
		}
	});

	$effect(() => {
		if (node) {
			nodeName = node.name || '';
			nodeType = [node.node_type?.id];
			nodeStatus = [node.status?.id];
			nodeNetworkLevel = [node.network_level?.id];
			nodeOwner = [node.owner?.id];
			nodeConstructor = [node.constructor?.id];
			nodeManufacturer = [node.manufacturer?.id];
			nodeWarranty = node.warranty || '';
			nodeDate = node.date || '';
			nodeFlag = [node.flag?.id];
		}
	});

	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(event.target);
		formData.append('uuid', id);
		formData.append('node_type_id', nodeType?.[0] || '');
		formData.append('status_id', nodeStatus?.[0] || '');
		formData.append('network_level_id', nodeNetworkLevel?.[0] || '');
		formData.append('owner_id', nodeOwner?.[0] || '');
		formData.append('constructor_id', nodeConstructor?.[0] || '');
		formData.append('manufacturer_id', nodeManufacturer?.[0] || '');
		formData.append('flag_id', nodeFlag?.[0] || '');

		try {
			const response = await fetch('?/updateNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_node()
				});
				return;
			}

			if (result.type === 'error') {
				const errorMessage = result.error?.message;
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_node()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_node()
			});
			if (onLabelUpdate && nodeName) {
				onLabelUpdate(nodeName);
			}
		} catch (error) {
			console.error('Error updating node:', error);
			globalToaster.error({
				title: m.message_error_updating_node()
			});
		}
	}

	async function confirmDelete() {
		if (!id) return;

		// Check for dependencies before showing delete dialog
		try {
			const formData = new FormData();
			formData.append('nodeUuid', id);

			const response = await fetch('?/getNodeDependencies', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			const cables = result.data?.cables || [];
			const structures = result.data?.structures || [];

			pendingDeleteCableCount = cables.length;
			pendingDeleteStructureCount = structures.length;

			// If cables are connected, block deletion and show info message
			if (cables.length > 0) {
				cableBlockedMessageBox.open();
				return;
			}

			// No cables connected, show confirmation for node deletion
			deleteMessageBox.open();
		} catch (err) {
			console.error('Error checking dependencies:', err);
			// Still allow delete on error
			pendingDeleteCableCount = 0;
			pendingDeleteStructureCount = 0;
			deleteMessageBox.open();
		}
	}

	async function handleDelete() {
		if (!id) return;

		const formData = new FormData();
		formData.append('uuid', id);

		try {
			const response = await fetch('?/deleteNode', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok && result.type !== 'error') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_node?.() || 'Node deleted successfully'
				});
				drawerStore.close();
				onNodeDelete?.(id);
			} else {
				throw new Error(
					result.message || m.message_error_deleting_node?.() || 'Failed to delete node'
				);
			}
		} catch (error) {
			console.error('Error deleting node:', error);
			globalToaster.error({
				title: m.common_error(),
				description: error.message || m.message_error_deleting_node?.() || 'Failed to delete node'
			});
		}
	}

	// Build dynamic delete message based on dependencies
	let deleteMessage = $derived.by(() => {
		const parts = [];
		if (pendingDeleteCableCount > 0) {
			parts.push(`${pendingDeleteCableCount} ${m.form_cables?.() || 'cables'}`);
		}
		if (pendingDeleteStructureCount > 0) {
			parts.push(`${pendingDeleteStructureCount} ${m.form_components?.() || 'components'}`);
		}

		if (parts.length > 0) {
			return `${m.message_confirm_delete_node?.() || 'Are you sure you want to delete this node?'} ${parts.join(', ')} ${m.common_will_be_deleted?.() || 'will be deleted'}.`;
		}
		return m.message_confirm_delete_node?.() || 'Are you sure you want to delete this node?';
	});
</script>

<!-- Node form -->
<form id="node-form" class="flex flex-col gap-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			type="text"
			class="input"
			placeholder=""
			name="node_name"
			required
			value={nodeName}
			oninput={(e) => (nodeName = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_node_type()}</span>
		<GenericCombobox
			data={attributes.nodeTypes}
			bind:value={nodeType}
			defaultValue={nodeType}
			onValueChange={(e) => (nodeType = e.value)}
			disabledValues={attributes.excludedNodeTypeIds}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={nodeStatus}
			defaultValue={nodeStatus}
			onValueChange={(e) => (nodeStatus = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={nodeNetworkLevel}
			defaultValue={nodeNetworkLevel}
			onValueChange={(e) => (nodeNetworkLevel = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeOwner}
			defaultValue={nodeOwner}
			onValueChange={(e) => (nodeOwner = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeConstructor}
			defaultValue={nodeConstructor}
			onValueChange={(e) => (nodeConstructor = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeManufacturer}
			defaultValue={nodeManufacturer}
			onValueChange={(e) => (nodeManufacturer = e.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_warranty()}</span>
		<input
			type="date"
			class="input"
			name="warranty"
			value={nodeWarranty}
			oninput={(e) => (nodeWarranty = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input
			type="date"
			class="input"
			name="date"
			value={nodeDate}
			oninput={(e) => (nodeDate = e.target.value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={nodeFlag}
			defaultValue={nodeFlag}
			onValueChange={(e) => (nodeFlag = e.value)}
		/>
	</label>
</form>

<!-- Update buttons -->
<div class="mt-6 flex flex-col items-end justify-end gap-3">
	<button type="submit" form="node-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
	<button
		type="button"
		onclick={confirmDelete}
		disabled={isCheckingDependencies || hasConnectedCables}
		{@attach tooltip(m.message_cannot_delete_node_has_cables(), { disabled: !hasConnectedCables })}
		class="btn preset-filled-error-500 w-full disabled:opacity-50 disabled:cursor-not-allowed"
	>
		{m.action_delete_node?.() || 'Delete Node'}
	</button>
</div>

<!-- Delete confirmation modal -->
<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm()}
	message={deleteMessage}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={handleDelete}
/>

<!-- Cable blocked modal - shown when cables are connected to node -->
<MessageBox
	bind:this={cableBlockedMessageBox}
	heading={m.common_warning()}
	message={m.message_cannot_delete_node_has_cables()}
	showAcceptButton={false}
/>
