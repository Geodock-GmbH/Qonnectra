<script>
	import { onMount, setContext } from 'svelte';
	import { IconLayoutList, IconPlug, IconTopologyRing2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import {
		DRAG_DROP_CONTEXT_KEY,
		NODE_STRUCTURE_CONTEXT_KEY,
		NodeStructureContext
	} from '$lib/classes/NodeStructureContext.svelte.js';
	import MessageBox from '$lib/components/MessageBox.svelte';

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

	// ========== Responsive State ==========
	let innerWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
	const isMobile = $derived(innerWidth < 768);

	// ========== UI State (local to this component) ==========
	let activeSheet = $state(null);
	let cableRefreshTrigger = $state(0);

	// Delete confirmation state
	let deleteMessageBox = $state(null);
	let pendingDeleteUuid = $state(null);
	let pendingDeleteSpliceCount = $state(0);

	// ========== Context Creation ==========
	const context = new NodeStructureContext(nodeUuid, {
		initialSlotConfigUuid,
		sharedSlotState
	});

	// Share context with children
	setContext(NODE_STRUCTURE_CONTEXT_KEY, context);
	setContext(DRAG_DROP_CONTEXT_KEY, context.getDragDropManager());

	// ========== Derived State from Context ==========
	const slotConfigurations = $derived(context.slotConfigurations);
	const selectedConfig = $derived(context.selectedConfig);
	const containerPath = $derived(context.containerPath);
	const slotRows = $derived(context.computeSlotRows());

	// ========== Effects ==========
	function handleResize() {
		innerWidth = window.innerWidth;
	}

	let previousNodeUuid = $state(nodeUuid);

	$effect(() => {
		if (nodeUuid && nodeUuid !== previousNodeUuid) {
			previousNodeUuid = nodeUuid;
			context.setNodeUuid(nodeUuid, sharedSlotState);
			context.initialize();
			cableRefreshTrigger++;
		}
	});

	$effect(() => {
		context.handleResponsiveChange(isMobile);
		if (!isMobile) {
			activeSheet = null;
		}
	});

	$effect(() => {
		if (initialSlotConfigUuid) {
			context.selectSlotConfig(initialSlotConfigUuid);
		}
	});

	$effect(() => {
		if (sharedSlotState?.lastUpdated) {
			context.syncWithSharedState(sharedSlotState);
		}
	});

	$effect(() => {
		if (context.selectedSlotConfigUuid) {
			context.fetchAllForSlotConfig();
		}
	});

	// ========== Event Handlers ==========
	function handleSideChange(e) {
		context.selectSlotConfig(e.target.value);
	}

	// Wrapper for structure select to handle mobile sheet
	async function handleStructureSelect(structure) {
		const wasSelected = await context.structureActions.onSelect(structure);
		if (isMobile && wasSelected) {
			activeSheet = 'ports';
		}
	}

	// Wrapper for structure delete to handle confirmation dialog
	async function handleDeleteStructure(structureUuid) {
		const result = await context.structureActions.onDelete(structureUuid);
		if (result?.needsConfirmation) {
			pendingDeleteUuid = result.structureUuid;
			pendingDeleteSpliceCount = result.spliceCount;
			deleteMessageBox.open();
		}
	}

	async function confirmDeleteStructure() {
		if (pendingDeleteUuid) {
			await context.executeDelete(pendingDeleteUuid);
			pendingDeleteUuid = null;
			pendingDeleteSpliceCount = 0;
		}
	}

	// Mobile-specific handlers
	function handleMobileComponentSelect(componentType) {
		context.sidebarActions.onMobileSelect(componentType);
		activeSheet = null;
	}

	function handleMobileFiberSelect(fiberData) {
		context.mobileActions.onFiberSelect(fiberData);
		activeSheet = 'ports';
	}

	onMount(() => {
		context.initialize();
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
					<div class="text-xs text-surface-950-50 mb-1">
						{containerPath}
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<select
						class="select flex-1 text-sm"
						value={context.selectedSlotConfigUuid}
						onchange={handleSideChange}
					>
						{#each slotConfigurations as config (config.uuid)}
							<option value={config.uuid}>{config.side}</option>
						{/each}
					</select>
					{#if selectedConfig}
						<span class="text-xs text-surface-950-50 whitespace-nowrap">
							{selectedConfig.total_slots}
							{m.form_slot({ count: selectedConfig.total_slots })}
						</span>
					{/if}
				</div>
				{#if context.mobileSelectedItem}
					<div
						class="mt-2 px-3 py-2 bg-primary-100 dark:bg-primary-900 rounded-lg text-sm flex items-center justify-between"
					>
						<span class="font-medium">{context.mobileSelectedItem.name}</span>
						<button
							type="button"
							class="text-xs text-primary-600 dark:text-primary-400"
							onclick={() => context.mobileActions.onClearSelection()}
						>
							{m.common_cancel()}
						</button>
					</div>
				{/if}
			</div>

			<!-- Slot Grid (now with minimal props - gets state from context) -->
			<div class="flex-1 overflow-hidden p-3">
				<SlotGrid
					{slotRows}
					loading={context.loading}
					loadingStructures={context.loadingStructures}
					{isMobile}
					onStructureSelect={handleStructureSelect}
					onStructureDelete={handleDeleteStructure}
				/>
			</div>

			<!-- Mobile Bottom Tabs -->
			<div
				class="fixed bottom-0 left-0 right-0 z-30 bg-surface-100-900 border-t border-surface-200-800"
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
						<span>{m.form_components()}</span>
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
						disabled={!context.selectedStructure}
					>
						<IconPlug size={20} />
						<span>{m.form_ports()}</span>
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
						: m.form_ports()}
			>
				{#if activeSheet === 'components'}
					<ComponentTypeSidebar {isMobile} onMobileSelect={handleMobileComponentSelect} />
				{:else if activeSheet === 'cables'}
					<CableFiberSidebar {nodeUuid} refreshTrigger={cableRefreshTrigger} {isMobile} />
				{:else if activeSheet === 'ports' && context.selectedStructure}
					<!-- PortTable now gets most state from context -->
					<PortTable
						structureName={context.selectedStructure.component_type?.component_type || '-'}
						portRows={context.portRowsWithMerge}
						loading={context.loadingPorts}
					/>
				{/if}
			</MobileBottomSheet>
		</div>
	{:else}
		<!-- ========== DESKTOP LAYOUT ========== -->
		<div class="flex h-full">
			<!-- Left Sidebar: Component Types -->
			<ComponentTypeSidebar
				onDragStart={context.sidebarActions.onDragStart}
				onDragEnd={context.sidebarActions.onDragEnd}
			/>

			<!-- Main Content -->
			<div class="flex-1 flex flex-col gap-4 p-4 min-w-0 overflow-hidden">
				<!-- Header -->
				<div class="flex-shrink-0 space-y-3">
					{#if containerPath}
						<div class="text-sm text-surface-950-50">
							<span class="font-medium">{m.form_container_path()}:</span>
							{containerPath}
						</div>
					{/if}

					<div class="flex items-center gap-3">
						<label class="label flex-1">
							<span class="text-sm font-medium">{m.form_select_side()}</span>
							<select
								class="select"
								value={context.selectedSlotConfigUuid}
								onchange={handleSideChange}
							>
								{#each slotConfigurations as config (config.uuid)}
									<option value={config.uuid}>{config.side}</option>
								{/each}
							</select>
						</label>

						{#if selectedConfig}
							<div class="text-sm text-surface-950-50 pt-5">
								{m.form_total_slots()}: {selectedConfig.total_slots}
							</div>
						{/if}
					</div>
				</div>

				<!-- Slot Grid and Port Table container - share space when both visible -->
				<div class="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
					<!-- Slot Grid (now with minimal props - gets state from context) -->
					<div class="flex-1 min-h-0 overflow-hidden">
						<SlotGrid
							{slotRows}
							loading={context.loading}
							loadingStructures={context.loadingStructures}
							{isMobile}
							onStructureSelect={handleStructureSelect}
							onStructureDelete={handleDeleteStructure}
						/>
					</div>

					<!-- Port Table (when structure selected) - now with minimal props -->
					{#if context.selectedStructure}
						<div class="flex-1 min-h-0 overflow-hidden">
							<PortTable
								structureName={context.selectedStructure.component_type?.component_type || '-'}
								portRows={context.portRowsWithMerge}
								loading={context.loadingPorts}
							/>
						</div>
					{/if}
				</div>
			</div>

			<!-- Right Sidebar: Cables/Fibers -->
			<CableFiberSidebar {nodeUuid} refreshTrigger={cableRefreshTrigger} />
		</div>
	{/if}
</div>

<!-- Delete confirmation modal for structures with fiber splices -->
<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm()}
	message={`${m.common_delete?.() || 'Delete'} ${m.form_component?.() || 'component'}? ${pendingDeleteSpliceCount} ${m.form_fiber_splices?.() || 'fiber splices'} ${m.common_will_be_deleted?.() || 'will be deleted'}.`}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={confirmDeleteStructure}
/>
