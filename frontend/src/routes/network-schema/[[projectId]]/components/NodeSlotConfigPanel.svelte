<script lang="ts">
	import type { ContainerNode, Hierarchy, SlotConfig } from './containerItemTypes';
	import type { SharedSlotState } from '$lib/classes/NodeStructureContext.svelte.js';
	import { flip } from 'svelte/animate';
	import { IconCheck, IconDownload, IconFolder, IconPlus, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import {
		createContainer,
		createSlotConfiguration,
		deleteContainer,
		deleteSlotConfiguration,
		exportNodeExcel,
		getContainerHierarchy,
		getContainerTypes,
		getNodeStructures,
		moveItem,
		toggleContainerExpanded,
		updateContainerName,
		updateSlotConfiguration
	} from '$lib/remote/network-schema/containers.remote';

	import ContainerItem from './ContainerItem.svelte';
	import SlotConfigItem from './SlotConfigItem.svelte';

	let {
		nodeUuid,
		nodeName = '',
		readonly = false,
		onViewStructure,
		sharedSlotState = $bindable(null)
	}: {
		nodeUuid: string;
		nodeName?: string;
		readonly?: boolean;
		onViewStructure?: (uuid: string) => void;
		sharedSlotState?: (SharedSlotState & { lastUpdated?: number }) | null;
	} = $props();

	let hierarchy = $state<Hierarchy>({
		containers: [],
		root_slot_configurations: []
	});
	let containerTypes = $state<{ id: number; name: string }[]>([]);
	let loading = $state(true);

	let editingUuid = $state<string | null>(null);
	let isCreating = $state(false);
	let formSide = $state('');
	let formTotalSlots = $state(1);

	let isCreatingContainer = $state(false);
	let selectedContainerTypeId = $state<number | null>(null);
	let containerName = $state('');

	let rootDragOver = $state(false);
	let exporting = $state(false);

	let deleteSlotConfigMessageBox = $state<ReturnType<typeof MessageBox> | null>(null);
	let pendingDeleteConfigUuid = $state<string | null>(null);
	let pendingDeleteStructureCount = $state(0);

	async function fetchContainerTypes() {
		try {
			containerTypes = await getContainerTypes();
		} catch (err) {
			console.error('Error fetching container types:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching container types',
				extraData: {
					from: 'NodeSlotConfigPanel.fetchContainerTypes',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
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
			hierarchy = (await getContainerHierarchy(nodeUuid)) || {
				containers: [],
				root_slot_configurations: []
			};

			if (sharedSlotState) {
				const allSlotConfigs = extractAllSlotConfigurations(hierarchy);
				sharedSlotState.nodeUuid = nodeUuid;
				sharedSlotState.slotConfigurations = allSlotConfigs;
				sharedSlotState.lastUpdated = Date.now();
			}
		} catch (err) {
			console.error('Error fetching hierarchy:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching hierarchy',
				extraData: {
					from: 'NodeSlotConfigPanel.fetchHierarchy',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_hierarchy?.() || 'Failed to fetch hierarchy'
			});
			hierarchy = { containers: [], root_slot_configurations: [] };
		} finally {
			loading = false;
		}
	}

	function extractAllSlotConfigurations(h: Hierarchy) {
		const configs = [...(h.root_slot_configurations || [])];

		function extractFromContainers(containers: ContainerNode[]) {
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
			await createContainer({
				nodeUuid,
				containerTypeId: selectedContainerTypeId,
				name: containerName.trim() || undefined
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_container?.() || 'Container created successfully'
			});
			resetForm();
			await fetchHierarchy();
		} catch (err) {
			console.error('Error creating container:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error creating container',
				extraData: {
					from: 'NodeSlotConfigPanel.handleCreateContainer',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_container?.() || 'Failed to create container'
			});
		}
	}

	async function handleDeleteContainer(uuid: string) {
		try {
			await deleteContainer(uuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_container?.() || 'Container deleted successfully'
			});
			await fetchHierarchy();
		} catch (err) {
			console.error('Error deleting container:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error deleting container',
				extraData: {
					from: 'NodeSlotConfigPanel.handleDeleteContainer',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_container?.() || 'Failed to delete container'
			});
		}
	}

	async function handleUpdateContainerName(uuid: string, newName: string) {
		try {
			await updateContainerName({ containerUuid: uuid, name: newName });

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_container()
			});
			await fetchHierarchy();
		} catch (err) {
			console.error('Error updating container name:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating container name',
				extraData: {
					from: 'NodeSlotConfigPanel.handleUpdateContainerName',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_container()
			});
		}
	}

	async function handleMove(
		dragData: { type: string; uuid: string },
		targetContainerId: string | null
	) {
		try {
			await moveItem({
				itemType: dragData.type as 'container' | 'slot_configuration',
				itemUuid: dragData.uuid,
				targetContainerId: targetContainerId || undefined
			});

			await fetchHierarchy();
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_moving_component()
			});
		} catch (err) {
			console.error('Error moving item:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error moving item',
				extraData: {
					from: 'NodeSlotConfigPanel.handleMove',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_moving_item?.() || 'Failed to move item'
			});
		}
	}

	function handleRootDragOver(e: DragEvent) {
		if (readonly) return;
		e.preventDefault();
		rootDragOver = true;
	}

	function handleRootDragLeave(e: DragEvent) {
		if (readonly) return;
		if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) {
			rootDragOver = false;
		}
	}

	function handleRootDrop(e: DragEvent) {
		if (readonly) return;
		e.preventDefault();
		rootDragOver = false;

		try {
			const data = JSON.parse(e.dataTransfer!.getData('application/json'));
			handleMove(data, null); // null = root level
		} catch (err) {
			console.error('Root drop error:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Root drop error',
				extraData: {
					from: 'NodeSlotConfigPanel.handleRootDrop',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_moving_item()
			});
		}
	}

	function handleToggleExpand(uuid: string) {
		hierarchy = updateContainerExpanded(hierarchy, uuid);

		// Fire-and-forget: persist expand state without blocking the optimistic UI.
		void toggleContainerExpanded(uuid).catch((err) => {
			console.error('Error toggling container:', err);
		});
	}

	function updateContainerExpanded(h: Hierarchy, uuid: string) {
		return {
			...h,
			containers: h.containers.map((c: ContainerNode) => updateContainerExpandedRecursive(c, uuid))
		};
	}

	function updateContainerExpandedRecursive(container: ContainerNode, uuid: string): ContainerNode {
		if (container.uuid === uuid) {
			return { ...container, is_expanded: !container.is_expanded };
		}
		if (container.children) {
			return {
				...container,
				children: container.children.map((c: ContainerNode) =>
					updateContainerExpandedRecursive(c, uuid)
				)
			};
		}
		return container;
	}

	async function handleCreate() {
		if (!formSide.trim() || formTotalSlots < 1) return;

		try {
			await createSlotConfiguration({
				nodeUuid,
				side: formSide.trim(),
				totalSlots: formTotalSlots
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_slot_configuration()
			});
			resetForm();
			await fetchHierarchy();
		} catch (error) {
			console.error('Error creating slot configuration:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error creating slot configuration',
				extraData: {
					from: 'NodeSlotConfigPanel.handleCreate',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_slot_configuration()
			});
		}
	}

	async function handleUpdate(uuid: string) {
		if (!formSide.trim() || formTotalSlots < 1) return;

		try {
			await updateSlotConfiguration({
				configUuid: uuid,
				side: formSide.trim(),
				totalSlots: formTotalSlots
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_slot_configuration()
			});
			resetForm();
			await fetchHierarchy();
		} catch (error) {
			console.error('Error updating slot configuration:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error updating slot configuration',
				extraData: {
					from: 'NodeSlotConfigPanel.handleUpdate',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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
	async function handleDelete(uuid: string) {
		try {
			const structures = await getNodeStructures(uuid);

			if (structures.length > 0) {
				pendingDeleteConfigUuid = uuid;
				pendingDeleteStructureCount = structures.length;
				deleteSlotConfigMessageBox?.open();
				return;
			}

			await executeDeleteSlotConfig(uuid);
		} catch (err) {
			console.error('Error checking structures before delete:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error checking structures before delete',
				extraData: {
					from: 'NodeSlotConfigPanel.handleDelete',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			await executeDeleteSlotConfig(uuid);
		}
	}

	async function executeDeleteSlotConfig(uuid: string) {
		try {
			await deleteSlotConfiguration(uuid);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_slot_configuration()
			});
			await fetchHierarchy();
		} catch (error) {
			console.error('Error deleting slot configuration:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error deleting slot configuration',
				extraData: {
					from: 'NodeSlotConfigPanel.executeDeleteSlotConfig',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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

	function startEdit(config: SlotConfig) {
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
			const exportData = await exportNodeExcel(nodeUuid);
			if (exportData?.fileData) {
				const bytes = Uint8Array.from(atob(exportData.fileData), (c) => c.charCodeAt(0));
				const blob = new Blob([bytes], {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = exportData.fileName || 'structure.xlsx';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_exporting_excel()
				});
			}
		} catch (err) {
			console.error('Error exporting Excel:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error exporting Excel',
				extraData: {
					from: 'NodeSlotConfigPanel.handleExportExcel',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
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
		containerTypes.map((t: { id: number; name: string }) => ({
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
						onValueChange={(e: { value: string[] }) => {
							selectedContainerTypeId = e.value[0] ? Number(e.value[0]) : null;
						}}
						renderInPlace={true}
					/>
				</div>
				<label class="label" for="container-name">
					<span class="text-sm">{m.form_container_name?.() || 'Name (optional)'}</span>
					<input
						id="container-name"
						name="container_name"
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
				<label class="label" for="slot-side">
					<span class="text-sm">{m.form_side()}</span>
					<input
						id="slot-side"
						name="side"
						type="text"
						class="input"
						bind:value={formSide}
						placeholder={m.placeholder_slot_side()}
						required
					/>
				</label>
				<label class="label" for="total-slots">
					<span class="text-sm">{m.form_total_slots()}</span>
					<input
						id="total-slots"
						name="total_slots"
						type="number"
						class="input"
						bind:value={formTotalSlots}
						min="1"
						required
					/>
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
