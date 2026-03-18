<script>
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';
	import { page } from '$app/stores';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import VirtualCombobox from '$lib/components/VirtualCombobox.svelte';
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

	const isChildView = $derived($page.url.pathname.includes('/node/'));

	let node = $derived($drawerStore.props);
	let id = $derived(node?.id || '');
	let nodeName = $state('');
	/** @type {any[]} */
	let nodeType = $state([]);
	/** @type {any[]} */
	let nodeStatus = $state([]);
	/** @type {any[]} */
	let nodeNetworkLevel = $state([]);
	/** @type {any[]} */
	let nodeOwner = $state([]);
	/** @type {any[]} */
	let nodeConstructor = $state([]);
	/** @type {any[]} */
	let nodeManufacturer = $state([]);
	let nodeWarranty = $state('');
	let nodeDate = $state('');
	/** @type {any[]} */
	let nodeFlag = $state([]);
	let nodeParentNode = $state('');
	/** @type {any[]} */
	let availableNodes = $state([]);
	let isLoadingParentNodes = $state(false);

	let { onLabelUpdate, onNodeDelete } = $props();

	/** @type {any} */
	let deleteMessageBox = $state(null);
	/** @type {any} */
	let cableBlockedMessageBox = $state(null);
	let pendingDeleteCableCount = $state(0);
	let pendingDeleteStructureCount = $state(0);
	let hasConnectedCables = $state(false);
	let hasChildren = $state(false);
	let hasChildrenWithCables = $state(false);
	let isCheckingDependencies = $state(false);

	let lastCheckedNodeId = $state('');

	/** Disabled when node has both children and cables, as changing type would break the hierarchy. */
	const nodeTypeDisabled = $derived(isCheckingDependencies || (hasChildren && hasConnectedCables));
	/** Disabled when in child view and node already has cables, to prevent re-parenting a wired node. */
	const parentNodeDisabled = $derived(
		isCheckingDependencies || (isChildView && hasConnectedCables)
	);

	/**
	 * Check dependencies when node changes (cables, structures, children)
	 */
	async function checkNodeDependencies(/** @type {any} */ nodeId) {
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

			const result = /** @type {any} */ (deserialize(await response.text()));
			const cables = result.data?.cables || [];
			const structures = result.data?.structures || [];
			const children = result.data?.children || [];
			const childrenWithCables = result.data?.childrenWithCables || [];

			// Only update state if this is still the current node
			if (lastCheckedNodeId === nodeId) {
				pendingDeleteCableCount = cables.length;
				pendingDeleteStructureCount = structures.length;
				hasConnectedCables = cables.length > 0;
				hasChildren = children.length > 0;
				hasChildrenWithCables = childrenWithCables.length > 0;
			}
		} catch (err) {
			console.error('Error checking dependencies:', err);
			if (lastCheckedNodeId === nodeId) {
				hasConnectedCables = false;
				hasChildren = false;
				hasChildrenWithCables = false;
			}
		} finally {
			if (lastCheckedNodeId === nodeId) {
				isCheckingDependencies = false;
			}
		}
	}

	$effect(() => {
		if (id) {
			pendingDeleteCableCount = 0;
			pendingDeleteStructureCount = 0;
			hasConnectedCables = false;
			hasChildren = false;
			hasChildrenWithCables = false;
			checkNodeDependencies(id);
		}
	});

	$effect(() => {
		if (node) {
			nodeName = node.name || '';
			nodeType = node.node_type?.id != null ? [node.node_type.id] : [];
			nodeStatus = node.status?.id != null ? [node.status.id] : [];
			nodeNetworkLevel = node.network_level?.id != null ? [node.network_level.id] : [];
			nodeOwner = node.owner?.id != null ? [node.owner.id] : [];
			nodeConstructor =
				/** @type {any} */ (node.constructor)?.id != null
					? [/** @type {any} */ (node.constructor).id]
					: [];
			nodeManufacturer = node.manufacturer?.id != null ? [node.manufacturer.id] : [];
			nodeWarranty = node.warranty || '';
			nodeDate = node.date || '';
			nodeFlag = node.flag?.id != null ? [node.flag.id] : [];
			nodeParentNode = node.parent_node?.uuid ?? '';
		}
	});

	/**
	 * Fetch available nodes for parent node selection
	 */
	async function fetchAvailableNodes() {
		isLoadingParentNodes = true;
		try {
			const response = await fetch('?/getAllNodes', {
				method: 'POST',
				body: new FormData()
			});

			const result = /** @type {any} */ (deserialize(await response.text()));
			if (result.data?.nodes) {
				availableNodes = result.data.nodes.filter((/** @type {any} */ n) => n.value !== id);
			}
		} catch (err) {
			console.error('Error fetching available nodes:', err);
		} finally {
			isLoadingParentNodes = false;
		}
	}

	$effect(() => {
		if (id) {
			fetchAvailableNodes();
		}
	});

	async function handleSubmit(/** @type {any} */ event) {
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
		formData.append('parent_node_id', nodeParentNode || '');

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

		try {
			const formData = new FormData();
			formData.append('nodeUuid', id);

			const response = await fetch('?/getNodeDependencies', {
				method: 'POST',
				body: formData
			});

			const result = /** @type {any} */ (deserialize(await response.text()));
			const cables = result.data?.cables || [];
			const structures = result.data?.structures || [];

			pendingDeleteCableCount = cables.length;
			pendingDeleteStructureCount = structures.length;

			if (cables.length > 0) {
				cableBlockedMessageBox?.open();
				return;
			}

			deleteMessageBox?.open();
		} catch (err) {
			console.error('Error checking dependencies:', err);
			pendingDeleteCableCount = 0;
			pendingDeleteStructureCount = 0;
			deleteMessageBox?.open();
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
				description:
					/** @type {any} */ (error).message ||
					m.message_error_deleting_node?.() ||
					'Failed to delete node'
			});
		}
	}

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
<form id="node-form" class="flex flex-col gap-4 mr-4" onsubmit={handleSubmit}>
	<label class="label">
		<span class="text-sm">{m.common_name()}</span>
		<input
			id="node-name"
			type="text"
			class="input"
			placeholder=""
			name="node_name"
			required
			value={nodeName}
			oninput={(e) => (nodeName = /** @type {any} */ (e.target).value)}
		/>
	</label>
	<label
		class="label"
		{@attach tooltip(
			m.message_node_type_locked_has_children_and_cables?.() ||
				'Node type cannot be changed (has children and cables)',
			{ disabled: !nodeTypeDisabled || isCheckingDependencies }
		)}
	>
		<span class="text-sm">{m.form_node_type()}</span>
		<GenericCombobox
			data={attributes.nodeTypes}
			bind:value={nodeType}
			defaultValue={nodeType}
			onValueChange={(/** @type {any} */ e) => (nodeType = e.value)}
			disabledValues={attributes.excludedNodeTypeIds}
			disabled={nodeTypeDisabled}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_status()}</span>
		<GenericCombobox
			data={attributes.statuses}
			bind:value={nodeStatus}
			defaultValue={nodeStatus}
			onValueChange={(/** @type {any} */ e) => (nodeStatus = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_network_level()}</span>
		<GenericCombobox
			data={attributes.networkLevels}
			bind:value={nodeNetworkLevel}
			defaultValue={nodeNetworkLevel}
			onValueChange={(/** @type {any} */ e) => (nodeNetworkLevel = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_owner()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeOwner}
			defaultValue={nodeOwner}
			onValueChange={(/** @type {any} */ e) => (nodeOwner = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_constructor()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeConstructor}
			defaultValue={nodeConstructor}
			onValueChange={(/** @type {any} */ e) => (nodeConstructor = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_manufacturer()}</span>
		<GenericCombobox
			data={attributes.companies}
			bind:value={nodeManufacturer}
			defaultValue={nodeManufacturer}
			onValueChange={(/** @type {any} */ e) => (nodeManufacturer = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_warranty()}</span>
		<input
			id="node-warranty"
			type="date"
			class="input"
			name="warranty"
			value={nodeWarranty}
			oninput={(e) => (nodeWarranty = /** @type {any} */ (e.target).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.common_date()}</span>
		<input
			id="node-date"
			type="date"
			class="input"
			name="date"
			value={nodeDate}
			oninput={(e) => (nodeDate = /** @type {any} */ (e.target).value)}
		/>
	</label>
	<label class="label">
		<span class="text-sm">{m.form_flag()}</span>
		<GenericCombobox
			data={attributes.flags}
			bind:value={nodeFlag}
			defaultValue={nodeFlag}
			onValueChange={(/** @type {any} */ e) => (nodeFlag = e.value)}
			renderInPlace={true}
		/>
	</label>
	<label
		class="label"
		{@attach tooltip(
			m.message_parent_node_locked_has_cables?.() || 'Parent node cannot be changed (has cables)',
			{ disabled: !parentNodeDisabled || isCheckingDependencies }
		)}
	>
		<span class="text-sm">{m.form_parent_node_name()}</span>
		<VirtualCombobox
			data={availableNodes}
			bind:value={nodeParentNode}
			disabled={parentNodeDisabled}
			loading={isLoadingParentNodes}
			placeholder={m.form_parent_node_name()}
			renderInPlace={true}
		/>
	</label>
</form>

<!-- Update buttons -->
<div
	class="sticky bottom-0 mt-6 mr-4 flex flex-col items-end justify-end gap-3 bg-surface-50-950 pb-2 pt-4"
>
	<button type="submit" form="node-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
	<button
		type="button"
		onclick={confirmDelete}
		disabled={isCheckingDependencies || hasConnectedCables || hasChildrenWithCables}
		{@attach tooltip(
			hasChildrenWithCables
				? m.message_cannot_delete_node_children_have_cables?.() ||
						'Cannot delete: child nodes have cables'
				: m.message_cannot_delete_node_has_cables(),
			{ disabled: !hasConnectedCables && !hasChildrenWithCables }
		)}
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
