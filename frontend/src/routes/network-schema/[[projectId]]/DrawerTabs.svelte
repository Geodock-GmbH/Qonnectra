<script>
	import { IconLayoutList, IconSettings } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';
	import NodeSlotConfigPanel from './NodeSlotConfigPanel.svelte';
	import NodeStructurePanel from './NodeStructurePanel.svelte';

	let allProps = $props();

	let slotConfigPanelOpen = $state(false);
	let structurePanelOpen = $state(false);
	let structurePanelSlotConfigUuid = $state(null);

	// Shared state for slot configurations - allows both panels to stay in sync
	// Using a reactive object that both panels can read and update
	let sharedSlotState = $state({
		slotConfigurations: [],
		lastUpdated: 0
	});

	let group = $state('attributes');

	const data = $derived.by(() => {
		const { type, onLabelUpdate, onEdgeDelete, ...rest } = allProps;
		return rest;
	});

	const type = $derived(allProps.type);
	const onLabelUpdate = $derived(allProps.onLabelUpdate);
	const onEdgeDelete = $derived(allProps.onEdgeDelete);

	const tabItems = $derived.by(() => {
		const baseTabs = [{ value: 'attributes', label: m.common_attributes() }];
		if (type === 'edge') {
			baseTabs.push({ value: 'handles', label: m.form_handles() });
		}
		if (type === 'node') {
			baseTabs.push({ value: 'actions', label: m.form_actions() });
		}
		baseTabs.push({ value: 'files', label: m.form_attachments() });
		return baseTabs;
	});

	$effect(() => {
		const availableTabs = tabItems.map((tab) => tab.value);
		if (!availableTabs.includes(group)) {
			group = 'attributes';
		}
	});

	const featureId = $derived(data?.uuid || data?.id);

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
</script>

<Tabs tabs={tabItems} bind:value={group}>
	{#if group === 'attributes'}
		{#if type === 'edge'}
			<CableDiagramEdgeAttributeCard {...data} {onLabelUpdate} {onEdgeDelete} />
		{:else if type === 'node'}
			<CableDiagramNodeAttributeCard {...data} {onLabelUpdate} />
		{/if}
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
		width={500}
		height={400}
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
