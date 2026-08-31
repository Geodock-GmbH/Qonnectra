<script lang="ts">
	import type { Fiber } from '$lib/classes/CableFiberDataManager.svelte';
	import type { SlotConfiguration } from '$lib/classes/NodeStructureContext.svelte.js';
	import type { AttributeOptions } from '$lib/types/attributeCardTypes';
	import { getContext, onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		IconLayoutList,
		IconLink,
		IconLoader,
		IconNetwork,
		IconRefresh,
		IconSettings
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { CableFiberDataManager } from '$lib/classes/CableFiberDataManager.svelte';
	import FibersStatusTable from '$lib/components/FibersStatusTable.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';

	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';
	import CableMicropipePanel from './CableMicropipePanel.svelte';
	import NodeSlotConfigPanel from './NodeSlotConfigPanel.svelte';
	import NodeStructurePanel from './NodeStructurePanel.svelte';
	import { getCableDetails } from './cables.remote';

	/** The drawer's props bag: a `type` discriminator, callbacks, and the feature's fields. */
	interface DrawerTabsProps {
		type?: 'node' | 'edge';
		uuid?: string;
		id?: string;
		node_type?: { id?: number | string } | number | string | null;
		onLabelUpdate?: (name: string) => void;
		onEdgeDelete?: (uuid: string) => void;
		onNodeDelete?: (id: string) => void;
		[key: string]: unknown;
	}

	const attributeOptions = getContext<AttributeOptions>('attributeOptions');

	const fiberDataManager = new CableFiberDataManager();

	let allProps: DrawerTabsProps = $props();

	let slotConfigPanelOpen = $state(false);
	let structurePanelOpen = $state(false);
	let structurePanelSlotConfigUuid = $state<string | null>(null);
	let micropipePanelOpen = $state(false);

	let sharedSlotState = $state<{
		nodeUuid: string | null;
		slotConfigurations: SlotConfiguration[];
		lastUpdated: number;
	}>({
		nodeUuid: null,
		slotConfigurations: [],
		lastUpdated: 0
	});

	let group = $state('attributes');

	const data = $derived.by(() => {
		const { type, onLabelUpdate, onEdgeDelete, onNodeDelete, ...rest } = allProps;
		return rest;
	});

	const isChildView = $derived($page.url.pathname.includes('/node/'));
	const childViewEnabledTypeIds = $derived(attributeOptions?.childViewEnabledNodeTypeIds ?? []);
	const nodeTypeRef = $derived(
		data?.node_type as { id?: number | string } | number | string | null | undefined
	);
	const nodeTypeId = $derived(
		nodeTypeRef && typeof nodeTypeRef === 'object' ? nodeTypeRef.id : nodeTypeRef
	);
	const showChildViewButton = $derived(
		!isChildView && nodeTypeId != null && childViewEnabledTypeIds.includes(nodeTypeId)
	);
	/**
	 * Navigates to the child network view for the currently selected node.
	 */
	function navigateToChildView() {
		const projectId = $page.params.projectId;
		const nodeId = data.uuid || data.id;
		goto(`/network-schema/${projectId}/node/${nodeId}`);
	}

	const type = $derived(allProps.type);
	const onLabelUpdate = $derived(allProps.onLabelUpdate);
	const onEdgeDelete = $derived(allProps.onEdgeDelete);
	const onNodeDelete = $derived(allProps.onNodeDelete);

	const tabItems = $derived.by(() => {
		const baseTabs = [{ value: 'attributes', label: m.common_attributes() }];
		if (type === 'edge') {
			baseTabs.push({ value: 'status', label: m.form_status() });
			baseTabs.push({ value: 'handles', label: m.form_handles() });
			baseTabs.push({ value: 'actions', label: m.form_actions() });
		}
		if (type === 'node') {
			baseTabs.push({ value: 'actions', label: m.form_actions() });
		}
		baseTabs.push({ value: 'files', label: m.form_attachments() });
		return baseTabs;
	});

	let lastFetchedFeatureId = $state<string | null>(null);

	/**
	 * Handles tab change events, lazily loading fiber data when the status tab is first selected.
	 * @param newValue - The newly selected tab value.
	 */
	function handleTabChange(newValue: string) {
		if (newValue === 'status' && featureId && type === 'edge') {
			if (featureId !== lastFetchedFeatureId) {
				lastFetchedFeatureId = featureId;
				fiberDataManager.fetchFibersForCable(featureId);
				fiberDataManager.fetchFiberColors();
			}
			fiberDataManager.fetchFiberStatusOptions();
		}
	}

	/**
	 * Updates the status of a fiber and shows a success/error toast notification.
	 * @param fiber - The fiber object to update.
	 * @param statusId - The new status ID, or null to clear the status.
	 */
	async function handleFiberStatusChange(fiber: Fiber, statusId: number | null) {
		const updated = await fiberDataManager.updateFiberStatus(fiber.uuid, statusId);

		if (updated) {
			fiberDataManager.updateFiberInCache(featureId, updated);
			globalToaster.success({
				title: m.message_status_updated(),
				duration: 3000
			});
		} else {
			globalToaster.error({
				title: m.message_status_update_failed(),
				duration: 5000
			});
		}
	}

	onMount(() => {
		return () => fiberDataManager.cleanup();
	});

	const featureId = $derived((data?.uuid || data?.id || '') as string);

	$effect(() => {
		if (group === 'status' && featureId && type === 'edge') {
			if (featureId !== lastFetchedFeatureId) {
				lastFetchedFeatureId = featureId;
				fiberDataManager.fetchFibersForCable(featureId);
				fiberDataManager.fetchFiberColors();
			}
		}
	});

	let recalculating = $state(false);

	let fileExplorer = $state<ReturnType<typeof FileExplorer> | null>(null);

	/**
	 * Refreshes the file explorer after a successful file upload.
	 */
	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}

	/**
	 * Opens the node structure panel, optionally pre-selecting a slot configuration.
	 * @param slotConfigUuid - UUID of the slot configuration to display, or null for the default view.
	 */
	function handleOpenStructurePanel(slotConfigUuid: string | null = null) {
		structurePanelSlotConfigUuid = slotConfigUuid;
		structurePanelOpen = true;
	}

	/**
	 * Triggers a server-side recalculation of the cable's routed length and refreshes the cable data on success.
	 */
	async function handleRecalculateLength() {
		if (!featureId || recalculating) return;
		recalculating = true;
		try {
			const formData = new FormData();
			formData.append('uuid', featureId);
			const response = await fetch('?/recalculateCableLength', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				globalToaster.success({
					title: m.message_cable_length_recalculated(),
					duration: 3000
				});
				await refreshCableData();
			} else {
				globalToaster.error({
					title: m.message_cable_length_recalculation_failed(),
					duration: 5000
				});
			}
		} catch (err) {
			console.error('Error recalculating cable length:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error recalculating cable length',
				extraData: {
					from: 'DrawerTabs.handleRecalculateLength',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.message_cable_length_recalculation_failed(),
				duration: 5000
			});
		} finally {
			recalculating = false;
		}
	}

	/**
	 * Refreshes cable data from the server, updates the drawer props, and dispatches
	 * a micropipeLinkageChanged event to update edge micropipe connection coloring.
	 */
	async function refreshCableData() {
		if (type !== 'edge' || !featureId) return;

		try {
			const parsedData = await getCableDetails(featureId);
			drawerStore.updateProps(parsedData);

			const formData = new FormData();
			formData.append('uuid', featureId);
			const micropipeResponse = await fetch(`?/getMicropipeConnectionsForCable`, {
				method: 'POST',
				body: formData
			});
			const micropipeResult = deserialize(await micropipeResponse.text());
			if (micropipeResult.type === 'success' && micropipeResult.data?.connections) {
				window.dispatchEvent(
					new CustomEvent('micropipeLinkageChanged', {
						detail: { cableId: featureId, connections: micropipeResult.data.connections }
					})
				);
			}
		} catch (err) {
			console.error('Error refreshing cable data:', err);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error refreshing cable data',
				extraData: {
					from: 'DrawerTabs.refreshCableData',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
		}
	}
</script>

<Tabs tabs={tabItems} bind:value={group} onValueChange={handleTabChange}>
	{#if group === 'attributes'}
		{#if type === 'edge'}
			<CableDiagramEdgeAttributeCard
				{...data}
				{onLabelUpdate}
				{onEdgeDelete}
				onSaveComplete={refreshCableData}
			/>
		{:else if type === 'node'}
			<CableDiagramNodeAttributeCard {...data} {onLabelUpdate} {onNodeDelete} />
		{/if}
	{/if}

	{#if group === 'status'}
		<div class="p-4">
			<FibersStatusTable
				fibers={fiberDataManager.getFibersForCable(featureId)}
				loading={fiberDataManager.isLoadingFibers(featureId)}
				error={null}
				statusOptions={fiberDataManager.fiberStatusOptions}
				onStatusChange={handleFiberStatusChange}
				getColorHex={(name) => fiberDataManager.getColorHex(name)}
			/>
		</div>
	{/if}

	{#if group === 'handles'}
		<CableDiagramEdgeHandleConfig />
	{/if}

	{#if group === 'actions'}
		{#if type === 'node'}
			<div class="space-y-4">
				<button
					type="button"
					class="btn preset-filled-primary-500 w-full"
					onclick={() => (slotConfigPanelOpen = true)}
				>
					<IconSettings size={18} />
					{m.action_configure_slots()}
				</button>
				<button
					type="button"
					class="btn preset-filled-secondary-500 w-full"
					onclick={() => handleOpenStructurePanel()}
				>
					<IconLayoutList size={18} />
					{m.action_configure_structure()}
				</button>
				{#if showChildViewButton}
					<button
						type="button"
						class="btn preset-filled-tertiary-500 w-full"
						onclick={navigateToChildView}
					>
						<IconNetwork size={18} />
						{m.action_open_child_network()}
					</button>
				{/if}
			</div>
		{:else if type === 'edge'}
			<div class="space-y-4">
				<button
					type="button"
					class="btn preset-filled-primary-500 w-full"
					onclick={() => (micropipePanelOpen = true)}
				>
					<IconLink size={18} />
					{m.action_link_micropipes()}
				</button>
				<button
					type="button"
					class="btn preset-filled-secondary-500 w-full"
					onclick={handleRecalculateLength}
					disabled={recalculating}
				>
					{#if recalculating}
						<IconLoader size={18} class="animate-spin" />
					{:else}
						<IconRefresh size={18} />
					{/if}
					{m.action_recalculate_cable_length()}
				</button>
			</div>
		{/if}
	{/if}

	{#if group === 'files'}
		<div class="space-y-4">
			<FileUpload
				featureType={type === 'edge' ? 'cable' : 'node'}
				{featureId}
				onUploadComplete={handleUploadComplete}
			/>
			<FileExplorer
				bind:this={fileExplorer}
				featureType={type === 'edge' ? 'cable' : 'node'}
				{featureId}
			/>
		</div>
	{/if}
</Tabs>

{#if type === 'node'}
	<FloatingPanel
		bind:open={slotConfigPanelOpen}
		title={m.title_slot_configuration()}
		width={900}
		height={600}
		maxWidth={1920}
		maxHeight={1080}
	>
		<NodeSlotConfigPanel
			nodeUuid={featureId}
			nodeName={data.name as string | undefined}
			onViewStructure={(slotConfigUuid) => handleOpenStructurePanel(slotConfigUuid)}
			bind:sharedSlotState
		/>
	</FloatingPanel>

	<FloatingPanel
		bind:open={structurePanelOpen}
		title={m.title_node_structure()}
		width={900}
		height={600}
		minWidth={600}
		minHeight={400}
		maxWidth={1920}
		maxHeight={1080}
	>
		<NodeStructurePanel
			nodeUuid={featureId}
			nodeName={data.name as string | undefined}
			initialSlotConfigUuid={structurePanelSlotConfigUuid}
			bind:sharedSlotState
		/>
	</FloatingPanel>
{/if}

{#if type === 'edge' && micropipePanelOpen}
	<FloatingPanel
		bind:open={micropipePanelOpen}
		title={m.title_cable_micropipe_linking()}
		width={1200}
		height={700}
		minWidth={800}
		minHeight={500}
		maxWidth={1920}
		maxHeight={1080}
	>
		<CableMicropipePanel
			cableId={featureId}
			cableName={(data.name as string) ?? ''}
			onClose={() => (micropipePanelOpen = false)}
			onLinkageChange={refreshCableData}
		/>
	</FloatingPanel>
{/if}
