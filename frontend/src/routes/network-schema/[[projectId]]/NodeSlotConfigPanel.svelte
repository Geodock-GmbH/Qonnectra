<script>
	import { flip } from 'svelte/animate';
	import { deserialize } from '$app/forms';
	import { IconCheck, IconFolder, IconPlus, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	import ContainerItem from './ContainerItem.svelte';
	import SlotConfigItem from './SlotConfigItem.svelte';

	let { nodeUuid, nodeName = '', onViewStructure, sharedSlotState = $bindable(null) } = $props();

	// Hierarchy state
	let hierarchy = $state({ containers: [], root_slot_configurations: [] });
	let containerTypes = $state([]);
	let loading = $state(true);

	// Form state for slot configuration
	let editingUuid = $state(null);
	let isCreating = $state(false);
	let formSide = $state('');
	let formTotalSlots = $state(1);

	// Form state for container creation
	let isCreatingContainer = $state(false);
	let selectedContainerTypeId = $state(null);
	let containerName = $state('');

	// Drag state for root drop zone
	let rootDragOver = $state(false);

	// Delete confirmation state
	let deleteSlotConfigMessageBox = $state(null);
	let pendingDeleteConfigUuid = $state(null);
	let pendingDeleteStructureCount = $state(0);

	/**
	 * Fetch container types (global)
	 */
	async function fetchContainerTypes() {
		try {
			const formData = new FormData();
			const response = await fetch('?/getContainerTypes', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				containerTypes = result.data?.containerTypes || [];
			}
		} catch (err) {
			console.error('Error fetching container types:', err);
		}
	}

	/**
	 * Fetch the full hierarchy tree for the node
	 */
	async function fetchHierarchy() {
		if (!nodeUuid) return;

		loading = true;
		resetForm();

		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);

			const response = await fetch('?/getContainerHierarchy', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch hierarchy');
			}

			hierarchy = result.data?.hierarchy || { containers: [], root_slot_configurations: [] };

			// Update shared state so NodeStructurePanel gets the latest slot configurations
			if (sharedSlotState) {
				// Flatten all slot configurations from hierarchy (root + nested in containers)
				const allSlotConfigs = extractAllSlotConfigurations(hierarchy);
				sharedSlotState.slotConfigurations = allSlotConfigs;
				sharedSlotState.lastUpdated = Date.now();
			}
		} catch (err) {
			console.error('Error fetching hierarchy:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_hierarchy?.() || 'Failed to fetch hierarchy'
			});
			hierarchy = { containers: [], root_slot_configurations: [] };
		} finally {
			loading = false;
		}
	}

	/**
	 * Extract all slot configurations from hierarchy (root level + nested in containers)
	 */
	function extractAllSlotConfigurations(h) {
		const configs = [...(h.root_slot_configurations || [])];

		function extractFromContainers(containers) {
			for (const container of containers || []) {
				if (container.slot_configurations) {
					configs.push(...container.slot_configurations);
				}
				if (container.children) {
					extractFromContainers(container.children);
				}
			}
		}

		extractFromContainers(h.containers);
		return configs;
	}

	/**
	 * Re-fetch when nodeUuid changes
	 */
	$effect(() => {
		const currentNodeUuid = nodeUuid;
		fetchContainerTypes();
		fetchHierarchy();
	});

	/**
	 * Create a new container
	 */
	async function handleCreateContainer() {
		if (!selectedContainerTypeId) return;

		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);
			formData.append('containerTypeId', selectedContainerTypeId.toString());
			if (containerName.trim()) {
				formData.append('name', containerName.trim());
			}

			const response = await fetch('?/createContainer', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to create container');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_container?.() || 'Container created successfully'
			});
			resetForm();
			await fetchHierarchy();
		} catch (err) {
			console.error('Error creating container:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_container?.() || 'Failed to create container'
			});
		}
	}

	/**
	 * Delete a container
	 */
	async function handleDeleteContainer(uuid) {
		try {
			const formData = new FormData();
			formData.append('containerUuid', uuid);

			const response = await fetch('?/deleteContainer', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to delete container');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_container?.() || 'Container deleted successfully'
			});
			await fetchHierarchy();
		} catch (err) {
			console.error('Error deleting container:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_container?.() || 'Failed to delete container'
			});
		}
	}

	/**
	 * Handle drag-and-drop move operations
	 */
	async function handleMove(dragData, targetContainerId) {
		try {
			const formData = new FormData();
			formData.append('itemType', dragData.type);
			formData.append('itemUuid', dragData.uuid);
			formData.append('targetContainerId', targetContainerId || '');

			const response = await fetch('?/moveItem', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to move item');
			}

			await fetchHierarchy();
		} catch (err) {
			console.error('Error moving item:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_moving_item?.() || 'Failed to move item'
			});
		}
	}

	/**
	 * Handle root drop zone
	 */
	function handleRootDragOver(e) {
		e.preventDefault();
		rootDragOver = true;
	}

	function handleRootDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			rootDragOver = false;
		}
	}

	function handleRootDrop(e) {
		e.preventDefault();
		rootDragOver = false;

		try {
			const data = JSON.parse(e.dataTransfer.getData('application/json'));
			handleMove(data, null); // null = root level
		} catch (err) {
			console.error('Root drop error:', err);
		}
	}

	/**
	 * Toggle container expand state
	 */
	async function handleToggleExpand(uuid) {
		// Update locally for immediate feedback
		hierarchy = updateContainerExpanded(hierarchy, uuid);

		// Persist to server (fire and forget)
		const formData = new FormData();
		formData.append('containerUuid', uuid);
		fetch('?/toggleContainerExpanded', {
			method: 'POST',
			body: formData
		});
	}

	function updateContainerExpanded(h, uuid) {
		return {
			...h,
			containers: h.containers.map((c) => updateContainerExpandedRecursive(c, uuid))
		};
	}

	function updateContainerExpandedRecursive(container, uuid) {
		if (container.uuid === uuid) {
			return { ...container, is_expanded: !container.is_expanded };
		}
		if (container.children) {
			return {
				...container,
				children: container.children.map((c) => updateContainerExpandedRecursive(c, uuid))
			};
		}
		return container;
	}

	// Slot configuration CRUD handlers (existing functionality)
	async function handleCreate() {
		if (!formSide.trim() || formTotalSlots < 1) return;

		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);
			formData.append('side', formSide.trim());
			formData.append('totalSlots', formTotalSlots.toString());

			const response = await fetch('?/createSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to create configuration');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_slot_configuration()
			});
			resetForm();
			await fetchHierarchy();
		} catch (error) {
			console.error('Error creating slot configuration:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_slot_configuration()
			});
		}
	}

	async function handleUpdate(uuid) {
		if (!formSide.trim() || formTotalSlots < 1) return;

		try {
			const formData = new FormData();
			formData.append('configUuid', uuid);
			formData.append('side', formSide.trim());
			formData.append('totalSlots', formTotalSlots.toString());

			const response = await fetch('?/updateSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to update configuration');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_slot_configuration()
			});
			resetForm();
			await fetchHierarchy();
		} catch (error) {
			console.error('Error updating slot configuration:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_slot_configuration()
			});
		}
	}

	async function handleDelete(uuid) {
		// Check if the slot configuration has structures before deleting
		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', uuid);

			const response = await fetch('?/getNodeStructures', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());
			const structures = result.data?.structures || [];

			if (structures.length > 0) {
				// Show confirmation dialog
				pendingDeleteConfigUuid = uuid;
				pendingDeleteStructureCount = structures.length;
				deleteSlotConfigMessageBox.open();
				return;
			}

			// No structures, delete directly
			await executeDeleteSlotConfig(uuid);
		} catch (err) {
			console.error('Error checking structures before delete:', err);
			// On error, proceed with delete (backend will handle cascading)
			await executeDeleteSlotConfig(uuid);
		}
	}

	async function executeDeleteSlotConfig(uuid) {
		try {
			const formData = new FormData();
			formData.append('configUuid', uuid);

			const response = await fetch('?/deleteSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to delete configuration');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_slot_configuration()
			});
			await fetchHierarchy();
		} catch (error) {
			console.error('Error deleting slot configuration:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_slot_configuration()
			});
		}
	}

	async function confirmDeleteSlotConfig() {
		if (pendingDeleteConfigUuid) {
			await executeDeleteSlotConfig(pendingDeleteConfigUuid);
			pendingDeleteConfigUuid = null;
			pendingDeleteStructureCount = 0;
		}
	}

	function startEdit(config) {
		editingUuid = config.uuid;
		formSide = config.side;
		formTotalSlots = config.total_slots;
		isCreating = false;
		isCreatingContainer = false;
	}

	function startCreate() {
		isCreating = true;
		editingUuid = null;
		isCreatingContainer = false;
		formSide = '';
		formTotalSlots = 1;
	}

	function startCreateContainer() {
		isCreatingContainer = true;
		isCreating = false;
		editingUuid = null;
		selectedContainerTypeId = null;
		containerName = '';
	}

	function resetForm() {
		editingUuid = null;
		isCreating = false;
		isCreatingContainer = false;
		formSide = '';
		formTotalSlots = 1;
		selectedContainerTypeId = null;
		containerName = '';
	}

	function handleSubmit() {
		if (isCreating) {
			handleCreate();
		} else if (editingUuid) {
			handleUpdate(editingUuid);
		}
	}

	const hasItems = $derived(
		hierarchy.containers.length > 0 || hierarchy.root_slot_configurations.length > 0
	);

	const hasContainerTypes = $derived(containerTypes.length > 0);
</script>

<!-- Main container -->
<div class="flex flex-col gap-4 h-full">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-950-50">
			{nodeName ? `${m.form_node()}: ${nodeName}` : m.title_slot_configuration()}
		</h3>
		{#if !isCreating && !isCreatingContainer && !editingUuid}
			<div class="flex gap-2">
				{#if hasContainerTypes}
					<button
						type="button"
						class="btn btn-sm preset-outlined-primary-500"
						onclick={startCreateContainer}
					>
						<IconFolder size={16} />
						{m.action_add_container?.() || 'Add Container'}
					</button>
				{/if}
				<button type="button" class="btn btn-sm preset-filled-primary-500" onclick={startCreate}>
					<IconPlus size={16} />
					{m.action_add()}
				</button>
			</div>
		{/if}
	</div>

	<!-- Container creation form -->
	{#if isCreatingContainer}
		<div class="card p-4 space-y-3 bg-surface-50-950 border border-surface-200-800">
			<div class="grid grid-cols-2 gap-3">
				<label class="label">
					<span class="text-sm">{m.form_container_type?.() || 'Container Type'}</span>
					<select class="select" bind:value={selectedContainerTypeId}>
						<option value={null}
							>{m.placeholder_select_container_type?.() || 'Select container type...'}</option
						>
						{#each containerTypes as type}
							<option value={type.id}>{type.name}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span class="text-sm">{m.form_container_name?.() || 'Name (optional)'}</span>
					<input
						type="text"
						class="input"
						bind:value={containerName}
						placeholder={m.placeholder_container_name?.() || 'Optional custom name'}
					/>
				</label>
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" class="btn btn-sm preset-outlined" onclick={resetForm}>
					<IconX size={16} />
					{m.common_cancel()}
				</button>
				<button
					type="button"
					class="btn btn-sm preset-filled-primary-500"
					onclick={handleCreateContainer}
					disabled={!selectedContainerTypeId}
				>
					<IconCheck size={16} />
					{m.action_save()}
				</button>
			</div>
		</div>
	{/if}

	<!-- Slot configuration form -->
	{#if isCreating || editingUuid}
		<div class="card p-4 space-y-3 bg-surface-50-950 border border-surface-200-800">
			<div class="grid grid-cols-2 gap-3">
				<label class="label">
					<span class="text-sm">{m.form_side()}</span>
					<input
						type="text"
						class="input"
						bind:value={formSide}
						placeholder={m.placeholder_slot_side()}
						required
					/>
				</label>
				<label class="label">
					<span class="text-sm">{m.form_total_slots()}</span>
					<input type="number" class="input" bind:value={formTotalSlots} min="1" required />
				</label>
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" class="btn btn-sm preset-outlined-primary-500" onclick={resetForm}>
					<IconX size={16} />
					{m.common_cancel()}
				</button>
				<button type="button" class="btn btn-sm preset-filled-primary-500" onclick={handleSubmit}>
					<IconCheck size={16} />
					{m.action_save()}
				</button>
			</div>
		</div>
	{/if}

	<!-- Hierarchy tree view -->
	<div
		class="flex-1 overflow-auto rounded-lg"
		class:drag-over-root={rootDragOver}
		ondragover={handleRootDragOver}
		ondragleave={handleRootDragLeave}
		ondrop={handleRootDrop}
		role="tree"
		tabindex="0"
	>
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.common_loading()}</span>
			</div>
		{:else if !hasItems}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.message_no_slot_configurations()}</span>
			</div>
		{:else}
			<div class="space-y-1">
				<!-- Root-level containers -->
				{#each hierarchy.containers as container (container.uuid)}
					<div animate:flip={{ duration: 200 }}>
						<ContainerItem
							{container}
							onDelete={handleDeleteContainer}
							onMove={handleMove}
							onToggleExpand={handleToggleExpand}
							onEditSlotConfig={startEdit}
							onDeleteSlotConfig={handleDelete}
							{onViewStructure}
						/>
					</div>
				{/each}

				<!-- Root-level slot configurations -->
				{#each hierarchy.root_slot_configurations as config (config.uuid)}
					<div animate:flip={{ duration: 200 }}>
						<SlotConfigItem {config} onEdit={startEdit} onDelete={handleDelete} {onViewStructure} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Delete confirmation modal for slot configs with structures -->
<MessageBox
	bind:this={deleteSlotConfigMessageBox}
	heading={m.common_confirm()}
	message={`${m.common_delete?.() || 'Delete'} ${m.form_slot_configuration?.() || 'slot configuration'}? ${pendingDeleteStructureCount} ${m.form_components?.() || 'components'} ${m.common_will_be_deleted?.() || 'will be deleted'}.`}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={confirmDeleteSlotConfig}
/>

<style>
	.drag-over-root {
		background-color: rgba(59, 130, 246, 0.05);
		outline: 2px dashed rgba(59, 130, 246, 0.5);
	}
</style>
