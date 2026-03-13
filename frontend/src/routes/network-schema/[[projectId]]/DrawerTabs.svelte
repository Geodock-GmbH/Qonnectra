<script>
	import { getContext, onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { IconLayoutList, IconLink, IconNetwork, IconSettings } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { CableFiberDataManager } from '$lib/classes/CableFiberDataManager.svelte.js';
	import FibersStatusTable from '$lib/components/FibersStatusTable.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';
	import CableMicropipePanel from './CableMicropipePanel.svelte';
	import NodeSlotConfigPanel from './NodeSlotConfigPanel.svelte';
	import NodeStructurePanel from './NodeStructurePanel.svelte';

	const attributeOptions = getContext('attributeOptions');

	const fiberDataManager = new CableFiberDataManager();

	let allProps = $props();

	let slotConfigPanelOpen = $state(false);
	let structurePanelOpen = $state(false);
	let structurePanelSlotConfigUuid = $state(null);
	let micropipePanelOpen = $state(false);

	let sharedSlotState = $state({
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
	const nodeTypeId = $derived(data?.node_type?.id ?? data?.node_type);
	const showChildViewButton = $derived(
		!isChildView && nodeTypeId != null && childViewEnabledTypeIds.includes(nodeTypeId)
	);
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

	let lastFetchedFeatureId = $state(null);

	/**
	 * Handle tab change - lazy load fibers for status tab
	 * @param {string} newValue
	 */
	function handleTabChange(newValue) {
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
	 * Handle fiber status change
	 * @param {Object} fiber
	 * @param {number|null} statusId
	 */
	async function handleFiberStatusChange(fiber, statusId) {
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

	$effect(() => {
		const availableTabs = tabItems.map((tab) => tab.value);
		if (!availableTabs.includes(group)) {
			group = 'attributes';
		}
	});

	const featureId = $derived(data?.uuid || data?.id);

	$effect(() => {
		if (group === 'status' && featureId && type === 'edge') {
			if (featureId !== lastFetchedFeatureId) {
				lastFetchedFeatureId = featureId;
				fiberDataManager.fetchFibersForCable(featureId);
				fiberDataManager.fetchFiberColors();
			}
		}
	});

	let fileExplorer = $state(null);

	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}

	function handleOpenStructurePanel(slotConfigUuid = null) {
		structurePanelSlotConfigUuid = slotConfigUuid;
		structurePanelOpen = true;
	}

	/**
	 * Refresh cable data from the server and update drawer props
	 * Also dispatches an event to update edge micropipe connections for dynamic coloring
	 */
	async function refreshCableData() {
		if (type !== 'edge' || !featureId) return;

		try {
			const formData = new FormData();
			formData.append('uuid', featureId);
			const response = await fetch('?/getCables', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());
			if (result.type === 'success' && result.data) {
				const parsedData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
				drawerStore.updateProps(parsedData);
			}

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
		<CableDiagramEdgeHandleConfig {...data} />
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
			nodeUuid={data.uuid || data.id}
			nodeName={data.name}
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
			nodeUuid={data.uuid || data.id}
			nodeName={data.name}
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
			cableId={data.uuid || data.id}
			cableName={data.name}
			onClose={() => (micropipePanelOpen = false)}
			onLinkageChange={refreshCableData}
		/>
	</FloatingPanel>
{/if}
