<script>
	import { IconLayoutGrid, IconLayoutList, IconSettings } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FeatureAttributeCard from '$lib/components/FeatureAttributeCard.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import NodeSlotConfigPanel from '../../network-schema/[[projectId]]/NodeSlotConfigPanel.svelte';
	import NodeStructurePanel from '../../network-schema/[[projectId]]/NodeStructurePanel.svelte';
	import MapCableAccordion from './MapCableAccordion.svelte';
	import MapConduitAccordion from './MapConduitAccordion.svelte';
	import TrenchProfilePanel from './TrenchProfilePanel.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Object} featureData - Feature properties from MVT
	 * @property {string} featureType - Type of feature ('trench', 'address', 'node')
	 * @property {string} featureId - UUID of the feature
	 * @property {Object} alias - Field name alias mapping (English -> Localized)
	 * @property {string|null} featureProjectId - Project ID of the feature (used in global view)
	 * @property {Array<{label: string, value: string}>} projects - List of projects for name lookup
	 */

	/** @type {Props} */
	let {
		featureData = {},
		featureType = 'trench',
		featureId = '',
		alias = {},
		featureProjectId = null,
		projects = []
	} = $props();

	let activeTab = $state('attributes');

	// Panel state for node structure panels
	let slotConfigPanelOpen = $state(false);
	let structurePanelOpen = $state(false);
	let structurePanelSlotConfigUuid = $state(null);

	// Panel state for trench profile
	let trenchProfilePanelOpen = $state(false);

	// Shared state for slot configurations - allows both panels to stay in sync
	let sharedSlotState = $state({
		slotConfigurations: [],
		lastUpdated: 0
	});

	const tabItems = $derived([
		{ value: 'attributes', label: m.common_attributes() },
		...(featureType === 'trench' ? [{ value: 'conduits', label: m.form_conduit_overview() }] : []),
		...(featureType === 'trench' ? [{ value: 'cables', label: m.form_cable_overview() }] : []),
		...(featureType === 'trench' ? [{ value: 'actions', label: m.form_actions() }] : []),
		...(featureType === 'node' ? [{ value: 'actions', label: m.form_actions() }] : []),
		{ value: 'files', label: m.form_attachments() }
	]);

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

<Tabs tabs={tabItems} bind:value={activeTab}>
	{#if activeTab === 'attributes'}
		<FeatureAttributeCard properties={featureData} {featureType} {alias} {projects} />
	{/if}

	{#if activeTab === 'conduits' && featureType === 'trench'}
		<MapConduitAccordion {featureId} />
	{/if}

	{#if activeTab === 'cables' && featureType === 'trench'}
		<MapCableAccordion {featureId} />
	{/if}

	{#if activeTab === 'actions' && featureType === 'trench'}
		<div class="space-y-4">
			<button
				type="button"
				class="btn preset-filled-primary-500 w-full"
				onclick={() => (trenchProfilePanelOpen = true)}
			>
				<IconLayoutGrid size={18} />
				{m.action_view_trench_profile()}
			</button>
		</div>
	{/if}

	{#if activeTab === 'actions' && featureType === 'node'}
		<div class="space-y-4">
			<button
				type="button"
				class="btn preset-filled-primary-500 w-full"
				onclick={() => (slotConfigPanelOpen = true)}
			>
				<IconSettings size={18} />
				{m.action_view_slot_configuration()}
			</button>
			<button
				type="button"
				class="btn preset-filled-secondary-500 w-full"
				onclick={() => handleOpenStructurePanel()}
			>
				<IconLayoutList size={18} />
				{m.action_view_structure()}
			</button>
		</div>
	{/if}

	{#if activeTab === 'files'}
		<div class="space-y-4">
			<FileUpload {featureType} {featureId} onUploadComplete={handleUploadComplete} />
			<FileExplorer bind:this={fileExplorer} {featureType} {featureId} />
		</div>
	{/if}
</Tabs>

{#if featureType === 'trench'}
	<FloatingPanel
		bind:open={trenchProfilePanelOpen}
		title={m.title_trench_profile()}
		width={900}
		height={600}
		minWidth={600}
		minHeight={400}
		maxWidth={1920}
		maxHeight={1080}
	>
		<TrenchProfilePanel trenchUuid={featureId} />
	</FloatingPanel>
{/if}

{#if featureType === 'node'}
	<FloatingPanel
		bind:open={slotConfigPanelOpen}
		title={m.title_slot_configuration()}
		width={900}
		height={600}
		minWidth={600}
		minHeight={400}
		maxWidth={1920}
		maxHeight={1080}
	>
		<NodeSlotConfigPanel
			nodeUuid={featureId}
			nodeName={featureData?.name || ''}
			readonly={true}
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
			nodeName={featureData?.name || ''}
			readonly={true}
			initialSlotConfigUuid={structurePanelSlotConfigUuid}
			bind:sharedSlotState
		/>
	</FloatingPanel>
{/if}
