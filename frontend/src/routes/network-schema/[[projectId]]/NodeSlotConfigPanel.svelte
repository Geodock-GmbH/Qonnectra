<script>
	import { flip } from 'svelte/animate';
	import { deserialize } from '$app/forms';
	import { IconCheck, IconDownload, IconFolder, IconPlus, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { tooltip } from '$lib/utils/tooltip';

	import ContainerItem from './ContainerItem.svelte';
	import SlotConfigItem from './SlotConfigItem.svelte';

	let {
		nodeUuid,
		nodeName = '',
		readonly = false,
		onViewStructure,
		sharedSlotState = $bindable(null)
	} = $props();

	/** @type {{containers: any[], root_slot_configurations: any[]}} */
	let hierarchy = $state({ containers: [], root_slot_configurations: [] });
	/** @type {any[]} */
	let containerTypes = $state([]);
	let loading = $state(true);

	let editingUuid = $state(null);
	let isCreating = $state(false);
	let formSide = $state('');
	let formTotalSlots = $state(1);

	let isCreatingContainer = $state(false);
	/** @type {any} */
	let selectedContainerTypeId = $state(null);
	let containerName = $state('');

	let rootDragOver = $state(false);
	let exporting = $state(false);

	/** @type {any} */
	let deleteSlotConfigMessageBox = $state(null);
	let pendingDeleteConfigUuid = $state(null);
	let pendingDeleteStructureCount = $state(0);

	async function fetchContainerTypes() {
		try {
			const formData = new FormData();
			const response = await fetch('?/getContainerTypes', {
				method: 'POST',
				body: formData
			});
			const result = /** @type {any} */ (deserialize(await response.text()));
			if (result.type === 'success') {
				containerTypes = result.data?.containerTypes || [];
			}
		} catch (err) {
			console.error('Error fetching container types:', err);
		}
	}

	/**
	 * Fetches the full container/slot hierarchy for the node and syncs shared slot state.
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

			const result = /** @type {any} */ (deserialize(await response.text()));

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch hierarchy');
			}

			hierarchy = result.data?.hierarchy || { containers: [], root_slot_configurations: [] };

			if (sharedSlotState) {
				const allSlotConfigs = extractAllSlotConfigurations(hierarchy);
				sharedSlotState.nodeUuid = nodeUuid;
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

	/** @param {any} h */
	function extractAllSlotConfigurations(h) {
		const configs = [...(h.root_slot_configurations || [])];

		/** @param {any} containers */
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

	$effect(() => {
		const currentNodeUuid = nodeUuid;
		fetchContainerTypes();
		fetchHierarchy();
	});

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

			const result = /** @type {any} */ (deserialize(await response.text()));

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

	/** @param {any} uuid */
	async function handleDeleteContainer(uuid) {
		try {
			const formData = new FormData();
			formData.append('containerUuid', uuid);

			const response = await fetch('?/deleteContainer', {
				method: 'POST',
				body: formData
			});

			const result = /** @type {any} */ (deserialize(await response.text()));

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

	/** @param {any} uuid @param {any} newName */
	async function handleUpdateContainerName(uuid, newName) {
		try {
			const formData = new FormData();
			formData.append('containerUuid', uuid);
			formData.append('name', newName);

			const response = await fetch('?/updateContainerName', {
				method: 'POST',
				body: formData
			});

			const result = /** @type {any} */ (deserialize(await response.text()));

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to update container name');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_container()
			});
			await fetchHierarchy();
		} catch (err) {
			console.error('Error updating container name:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_container()
			});
		}
	}

	/** @param {any} dragData @param {any} targetContainerId */
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

			const result = /** @type {any} */ (deserialize(await response.text()));

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

	/** @param {any} e */
	function handleRootDragOver(e) {
		if (readonly) return;
		e.preventDefault();
		rootDragOver = true;
	}

	/** @param {any} e */
	function handleRootDragLeave(e) {
		if (readonly) return;
		if (!e.currentTarget.contains(e.relatedTarget)) {
			rootDragOver = false;
		}
	}

	/** @param {any} e */
	function handleRootDrop(e) {
		if (readonly) return;
		e.preventDefault();
		rootDragOver = false;

		try {
			const data = JSON.parse(e.dataTransfer.getData('application/json'));
			handleMove(data, null); // null = root level
		} catch (err) {
			console.error('Root drop error:', err);
		}
	}

	/** @param {any} uuid */
	async function handleToggleExpand(uuid) {
		hierarchy = updateContainerExpanded(hierarchy, uuid);

		// Fire-and-forget: persist expand state without blocking
		const formData = new FormData();
		formData.append('containerUuid', uuid);
		fetch('?/toggleContainerExpanded', {
			method: 'POST',
			body: formData
		});
	}

	/** @param {any} h @param {any} uuid */
	function updateContainerExpanded(h, uuid) {
		return {
			...h,
			containers: h.containers.map((/** @type {any} */ c) =>
				updateContainerExpandedRecursive(c, uuid)
			)
		};
	}

	/** @param {any} container @param {any} uuid */
	function updateContainerExpandedRecursive(container, uuid) {
		if (container.uuid === uuid) {
			return { ...container, is_expanded: !container.is_expanded };
		}
		if (container.children) {
			return {
				...container,
				children: container.children.map((/** @type {any} */ c) =>
					updateContainerExpandedRecursive(c, uuid)
				)
			};
		}
		return container;
	}

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

			const result = /** @type {any} */ (deserialize(await response.text()));

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

	/** @param {any} uuid */
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

			const result = /** @type {any} */ (deserialize(await response.text()));

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

	/**
	 * Guards deletion: fetches associated structures first and prompts for
	 * confirmation if any exist, since they will be cascade-deleted.
	 */
	/** @param {any} uuid */
	async function handleDelete(uuid) {
		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', uuid);

			const response = await fetch('?/getNodeStructures', {
				method: 'POST',
				body: formData
			});

			const result = /** @type {any} */ (deserialize(await response.text()));
			const structures = result.data?.structures || [];

			if (structures.length > 0) {
				pendingDeleteConfigUuid = uuid;
				pendingDeleteStructureCount = structures.length;
				deleteSlotConfigMessageBox.open();
				return;
			}

			await executeDeleteSlotConfig(uuid);
		} catch (err) {
			console.error('Error checking structures before delete:', err);
			await executeDeleteSlotConfig(uuid);
		}
	}

	/** @param {any} uuid */
	async function executeDeleteSlotConfig(uuid) {
		try {
			const formData = new FormData();
			formData.append('configUuid', uuid);

			const response = await fetch('?/deleteSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = /** @type {any} */ (deserialize(await response.text()));

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

	/** @param {any} config */
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

	/**
	 * Export node structure data as Excel file
	 */
	async function handleExportExcel() {
		if (exporting || !nodeUuid) return;
		exporting = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);
			const response = await fetch('?/exportExcel', {
				method: 'POST',
				body: formData
			});
			const result = /** @type {any} */ (deserialize(await response.text()));
			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Export failed');
			}
			if (result.data?.fileData) {
				const bytes = Uint8Array.from(atob(result.data.fileData), (c) => c.charCodeAt(0));
				const blob = new Blob([bytes], {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = result.data.fileName || 'structure.xlsx';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}
		} catch (err) {
			console.error('Error exporting Excel:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_exporting_excel()
			});
		} finally {
			exporting = false;
		}
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
	const containerTypeData = $derived(
		containerTypes.map((/** @type {{ id: number, name: string }} */ t) => ({
			value: String(t.id),
			label: t.name
		}))
	);
</script>

<div class="flex flex-col gap-4 h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-950-50">
			{nodeName ? `${m.form_node()}: ${nodeName}` : m.title_slot_configuration()}
		</h3>
		<div class="flex gap-2">
			{#if nodeUuid}
				<button
					type="button"
					class="btn btn-sm preset-outlined"
					onclick={handleExportExcel}
					disabled={exporting}
					{@attach tooltip(m.action_export_excel?.() || 'Export Excel')}
				>
					<IconDownload size={16} />
				</button>
			{/if}
			{#if !readonly && !isCreating && !isCreatingContainer && !editingUuid}
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
			{/if}
		</div>
	</div>

	{#if isCreatingContainer && !readonly}
		<div class="card p-4 space-y-3 bg-surface-50-950 border border-surface-200-800">
			<div class="grid grid-cols-2 gap-3">
				<div class="label">
					<span class="text-sm">{m.form_container_type?.() || 'Container Type'}</span>
					<GenericCombobox
						data={containerTypeData}
						value={selectedContainerTypeId != null ? [String(selectedContainerTypeId)] : []}
						placeholder={m.placeholder_select_container_type?.() || 'Select container type...'}
						onValueChange={(/** @type {{ value: string[] }} */ e) => {
							selectedContainerTypeId = e.value[0] ? Number(e.value[0]) : null;
						}}
						renderInPlace={true}
					/>
				</div>
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

	{#if (isCreating || editingUuid) && !readonly}
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

	<div
		class="flex-1 overflow-auto rounded-lg"
		class:drag-over-root={rootDragOver && !readonly}
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
				{#each hierarchy.containers as container (container.uuid)}
					<div animate:flip={{ duration: 200 }}>
						<ContainerItem
							{container}
							{readonly}
							onDelete={handleDeleteContainer}
							onUpdateName={handleUpdateContainerName}
							onMove={handleMove}
							onToggleExpand={handleToggleExpand}
							onEditSlotConfig={startEdit}
							onDeleteSlotConfig={handleDelete}
							{onViewStructure}
						/>
					</div>
				{/each}

				{#each hierarchy.root_slot_configurations as config (config.uuid)}
					<div animate:flip={{ duration: 200 }}>
						<SlotConfigItem
							{config}
							{readonly}
							onEdit={startEdit}
							onDelete={handleDelete}
							{onViewStructure}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

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
