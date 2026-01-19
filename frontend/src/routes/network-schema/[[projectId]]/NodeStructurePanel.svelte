<script>
	import { onMount, setContext } from 'svelte';
	import { IconLayoutList, IconPlug, IconTopologyRing2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { DRAG_DROP_CONTEXT_KEY, DragDropManager } from '$lib/classes/DragDropManager.svelte.js';
	import { FiberSpliceManager } from '$lib/classes/FiberSpliceManager.svelte.js';
	import { NodeStructureManager } from '$lib/classes/NodeStructureManager.svelte.js';
	import { globalToaster } from '$lib/stores/toaster';

	import CableFiberSidebar from './CableFiberSidebar.svelte';
	import ComponentTypeSidebar from './ComponentTypeSidebar.svelte';
	import MobileBottomSheet from './MobileBottomSheet.svelte';
	import PortTable from './PortTable.svelte';
	import SlotGrid from './SlotGrid.svelte';

	let {
		nodeUuid,
		nodeName = '',
		initialSlotConfigUuid = null,
		sharedSlotState = $bindable(null)
	} = $props();

	let innerWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
	const isMobile = $derived(innerWidth < 768);

	let activeSheet = $state(null);

	let cableRefreshTrigger = $state(0);

	let editingClipSlot = $state(null);
	let editingClipValue = $state('');

	const structureManager = new NodeStructureManager(
		nodeUuid,
		initialSlotConfigUuid,
		sharedSlotState
	);
	const spliceManager = new FiberSpliceManager();
	const dragDropManager = new DragDropManager();

	setContext(DRAG_DROP_CONTEXT_KEY, dragDropManager);

	const slotConfigurations = $derived(structureManager.slotConfigurations);
	const selectedConfig = $derived(structureManager.selectedConfig);
	const containerPath = $derived(structureManager.containerPath);

	const slotRows = $derived.by(() => {
		const baseRows = structureManager.computeSlotRows();
		return baseRows.map((row) => ({
			...row,
			isDropTarget: dragDropManager.dropPreviewSlots.includes(row.slotNumber)
		}));
	});

	function handleResize() {
		innerWidth = window.innerWidth;
	}

	let previousNodeUuid = $state(nodeUuid);

	$effect(() => {
		if (nodeUuid && nodeUuid !== previousNodeUuid) {
			previousNodeUuid = nodeUuid;

			structureManager.setNodeUuid(nodeUuid, sharedSlotState);
			structureManager.fetchSlotConfigurations();

			spliceManager.closePortTable();

			dragDropManager.cleanup();

			cableRefreshTrigger++;
		}
	});

	$effect(() => {
		dragDropManager.handleResponsiveChange(isMobile);
		if (!isMobile) {
			activeSheet = null;
		}
	});

	$effect(() => {
		if (initialSlotConfigUuid) {
			structureManager.selectSlotConfig(initialSlotConfigUuid);
		}
	});

	$effect(() => {
		if (sharedSlotState?.lastUpdated) {
			structureManager.syncWithSharedState(sharedSlotState);
		}
	});

	$effect(() => {
		if (structureManager.selectedSlotConfigUuid) {
			structureManager.fetchAllForSlotConfig();
		}
	});

	// ========== Event Handlers ==========

	function handleSideChange(e) {
		structureManager.selectSlotConfig(e.target.value);
	}

	function startEditingClip(slotNumber, currentValue) {
		editingClipSlot = slotNumber;
		editingClipValue = currentValue || String(slotNumber);
	}

	async function saveClipNumber() {
		if (editingClipSlot === null || !editingClipValue.trim()) {
			editingClipSlot = null;
			editingClipValue = '';
			return;
		}

		const slotNumber = editingClipSlot;
		const clipValue = editingClipValue;

		editingClipSlot = null;
		editingClipValue = '';

		await structureManager.saveClipNumber(slotNumber, clipValue);
	}

	function handleClipKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveClipNumber();
		} else if (e.key === 'Escape') {
			editingClipSlot = null;
			editingClipValue = '';
		}
	}

	async function toggleDivider(slotNumber) {
		await structureManager.toggleDivider(slotNumber);
	}

	// ========== Drag Handlers ==========

	function handleSidebarDragStart(componentType) {
		dragDropManager.startComponentDrag(componentType);
	}

	function handleSidebarDragEnd() {
		dragDropManager.endDrag();
	}

	function handleStructureDragStart(e, structure) {
		dragDropManager.startStructureDrag(e, structure);
	}

	function handleSlotDragOver(e, slotNumber) {
		e.preventDefault();

		const { canDrop } = dragDropManager.updateDropPreview(
			slotNumber,
			selectedConfig?.total_slots || 0,
			structureManager.occupiedSlots
		);

		e.dataTransfer.dropEffect = dragDropManager.getDropEffect(canDrop);
	}

	async function handleSlotDrop(e, slotNumber) {
		e.preventDefault();
		dragDropManager.clearDropPreview();

		const data = dragDropManager.parseDropData(e);
		if (!data) {
			dragDropManager.endDrag();
			return;
		}

		try {
			if (data.type === 'component_type') {
				await structureManager.createStructure(data, slotNumber);
			} else if (data.type === 'existing_structure') {
				if (data.slot_start === slotNumber) {
					dragDropManager.endDrag();
					return;
				}
				await structureManager.moveStructure(data, slotNumber);
			}
		} catch (err) {
			console.error('Drop error:', err);
			globalToaster.error({
				title: m.common_error(),
				description: err.message || m.message_error_placing_component()
			});
		}

		dragDropManager.endDrag();
	}

	// ========== Mobile Handlers ==========

	function handleMobileComponentSelect(componentType) {
		dragDropManager.selectMobileComponent(componentType);
		activeSheet = null;
	}

	async function handleMobileSlotTap(slotNumber) {
		if (!dragDropManager.mobileSelectedItem) return;

		try {
			await structureManager.createStructure(dragDropManager.mobileSelectedItem, slotNumber);
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: err.message || m.message_error_placing_component()
			});
		}

		dragDropManager.clearMobileSelection();
	}

	function handleMobileFiberSelect(fiberData) {
		dragDropManager.selectMobileItem(fiberData);
		activeSheet = 'ports';
	}

	// ========== Structure Selection / Port Table ==========

	async function handleStructureSelect(structure) {
		const wasSelected = await spliceManager.selectStructure(structure, isMobile);

		if (isMobile && wasSelected) {
			activeSheet = 'ports';
		}
	}

	async function handleDeleteStructure(structureUuid) {
		const deleted = await structureManager.deleteStructure(structureUuid);
		if (deleted) {
			spliceManager.onStructureDeleted(structureUuid);
		}
	}

	async function handlePortDrop(portNumber, side, fiberData) {
		const success = await spliceManager.handlePortDrop(portNumber, side, fiberData);

		if (isMobile && success && dragDropManager.mobileSelectedItem?.type === 'fiber') {
			dragDropManager.clearMobileSelection();
		}
	}

	async function handleClearPort(portNumber, side) {
		await spliceManager.handleClearPort(portNumber, side);
	}

	function handleClosePortTable() {
		spliceManager.closePortTable();
	}

	onMount(() => {
		structureManager.fetchSlotConfigurations();
		cableRefreshTrigger++;

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);
			return () => window.removeEventListener('resize', handleResize);
		}
	});
</script>

<div class="flex flex-col h-full">
	{#if isMobile}
		<!-- ========== MOBILE LAYOUT ========== -->
		<div class="flex flex-col h-full pb-16">
			<!-- Header -->
			<div class="flex-shrink-0 p-3 border-b border-surface-200-800 bg-surface-100-900">
				{#if containerPath}
					<div class="text-xs text-surface-500 mb-1">
						{containerPath}
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<select
						class="select flex-1 text-sm"
						value={structureManager.selectedSlotConfigUuid}
						onchange={handleSideChange}
					>
						{#each slotConfigurations as config (config.uuid)}
							<option value={config.uuid}>{config.side}</option>
						{/each}
					</select>
					{#if selectedConfig}
						<span class="text-xs text-surface-500 whitespace-nowrap">
							{selectedConfig.total_slots}
							{m.form_slots?.() || 'Slots'}
						</span>
					{/if}
				</div>
				{#if dragDropManager.mobileSelectedItem}
					<div
						class="mt-2 px-3 py-2 bg-primary-100 dark:bg-primary-900 rounded-lg text-sm flex items-center justify-between"
					>
						<span class="font-medium">{dragDropManager.mobileSelectedItem.name}</span>
						<button
							type="button"
							class="text-xs text-primary-600 dark:text-primary-400"
							onclick={() => dragDropManager.clearMobileSelection()}
						>
							{m.common_cancel?.() || 'Cancel'}
						</button>
					</div>
				{/if}
			</div>

			<!-- Slot Grid -->
			<div class="flex-1 overflow-hidden p-3">
				<SlotGrid
					{slotRows}
					structures={structureManager.structures}
					selectedStructure={spliceManager.selectedStructure}
					isDragging={dragDropManager.isDragging}
					draggedItem={dragDropManager.draggedItem}
					bind:dropPreviewSlots={dragDropManager.dropPreviewSlots}
					occupiedSlots={structureManager.occupiedSlots}
					loading={structureManager.loading}
					loadingStructures={structureManager.loadingStructures}
					{isMobile}
					mobileSelectedItem={dragDropManager.mobileSelectedItem}
					onSlotTap={handleMobileSlotTap}
					onStructureSelect={handleStructureSelect}
					onStructureDelete={handleDeleteStructure}
					onToggleDivider={toggleDivider}
					onStartEditingClip={startEditingClip}
					{editingClipSlot}
					bind:editingClipValue
					onSaveClipNumber={saveClipNumber}
					onClipKeydown={handleClipKeydown}
				/>
			</div>

			<!-- Mobile Bottom Tabs -->
			<div
				class="fixed bottom-0 left-0 right-0 z-30
				       bg-surface-100-900 border-t border-surface-200-800"
			>
				<div class="grid grid-cols-3 gap-1 p-2">
					<button
						type="button"
						class="btn flex-col gap-1 py-2 text-xs {activeSheet === 'components'
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeSheet = activeSheet === 'components' ? null : 'components')}
					>
						<IconLayoutList size={20} />
						<span>{m.form_components?.() || 'Components'}</span>
					</button>
					<button
						type="button"
						class="btn flex-col gap-1 py-2 text-xs {activeSheet === 'cables'
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeSheet = activeSheet === 'cables' ? null : 'cables')}
					>
						<IconTopologyRing2 size={20} />
						<span>{m.form_cables()}</span>
					</button>
					<button
						type="button"
						class="btn flex-col gap-1 py-2 text-xs {activeSheet === 'ports'
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeSheet = activeSheet === 'ports' ? null : 'ports')}
						disabled={!spliceManager.selectedStructure}
					>
						<IconPlug size={20} />
						<span>{m.form_ports?.() || 'Ports'}</span>
					</button>
				</div>
			</div>

			<!-- Mobile Bottom Sheets -->
			<MobileBottomSheet
				bind:open={activeSheet}
				title={activeSheet === 'components'
					? m.form_component_types()
					: activeSheet === 'cables'
						? m.form_cables()
						: m.form_ports?.() || 'Ports'}
			>
				{#if activeSheet === 'components'}
					<ComponentTypeSidebar {isMobile} onMobileSelect={handleMobileComponentSelect} />
				{:else if activeSheet === 'cables'}
					<CableFiberSidebar {nodeUuid} refreshTrigger={cableRefreshTrigger} {isMobile} />
				{:else if activeSheet === 'ports' && spliceManager.selectedStructure}
					<PortTable
						structureName={spliceManager.selectedStructure.component_type?.component_type || '-'}
						portRows={spliceManager.portRows}
						fiberColors={spliceManager.fiberColors}
						loading={spliceManager.loadingPorts}
						onPortDrop={handlePortDrop}
						onClearPort={handleClearPort}
						onClose={handleClosePortTable}
					/>
				{/if}
			</MobileBottomSheet>
		</div>
	{:else}
		<!-- ========== DESKTOP LAYOUT ========== -->
		<div class="flex h-full">
			<!-- Left Sidebar: Component Types -->
			<ComponentTypeSidebar onDragStart={handleSidebarDragStart} onDragEnd={handleSidebarDragEnd} />

			<!-- Main Content -->
			<div class="flex-1 flex flex-col gap-4 p-4 min-w-0 overflow-hidden">
				<!-- Header -->
				<div class="flex-shrink-0 space-y-3">
					{#if containerPath}
						<div class="text-sm text-surface-500">
							<span class="font-medium">{m.form_container_path?.() || 'Container'}:</span>
							{containerPath}
						</div>
					{/if}

					<div class="flex items-center gap-3">
						<label class="label flex-1">
							<span class="text-sm font-medium">{m.form_select_side()}</span>
							<select
								class="select"
								value={structureManager.selectedSlotConfigUuid}
								onchange={handleSideChange}
							>
								{#each slotConfigurations as config (config.uuid)}
									<option value={config.uuid}>{config.side}</option>
								{/each}
							</select>
						</label>

						{#if selectedConfig}
							<div class="text-sm text-surface-500 pt-5">
								{m.form_total_slots()}: {selectedConfig.total_slots}
							</div>
						{/if}
					</div>
				</div>

				<!-- Slot Grid -->
				<SlotGrid
					{slotRows}
					structures={structureManager.structures}
					selectedStructure={spliceManager.selectedStructure}
					isDragging={dragDropManager.isDragging}
					draggedItem={dragDropManager.draggedItem}
					bind:dropPreviewSlots={dragDropManager.dropPreviewSlots}
					occupiedSlots={structureManager.occupiedSlots}
					loading={structureManager.loading}
					loadingStructures={structureManager.loadingStructures}
					{isMobile}
					onSlotDragOver={handleSlotDragOver}
					onSlotDrop={handleSlotDrop}
					onStructureDragStart={handleStructureDragStart}
					onStructureDragEnd={handleSidebarDragEnd}
					onStructureSelect={handleStructureSelect}
					onStructureDelete={handleDeleteStructure}
					onToggleDivider={toggleDivider}
					onStartEditingClip={startEditingClip}
					{editingClipSlot}
					bind:editingClipValue
					onSaveClipNumber={saveClipNumber}
					onClipKeydown={handleClipKeydown}
				/>

				<!-- Port Table (when structure selected) -->
				{#if spliceManager.selectedStructure}
					<div class="flex-shrink-0">
						<PortTable
							structureName={spliceManager.selectedStructure.component_type?.component_type || '-'}
							portRows={spliceManager.portRows}
							fiberColors={spliceManager.fiberColors}
							loading={spliceManager.loadingPorts}
							onPortDrop={handlePortDrop}
							onClearPort={handleClearPort}
							onClose={handleClosePortTable}
						/>
					</div>
				{/if}
			</div>

			<!-- Right Sidebar: Cables/Fibers -->
			<CableFiberSidebar {nodeUuid} refreshTrigger={cableRefreshTrigger} />
		</div>
	{/if}
</div>
