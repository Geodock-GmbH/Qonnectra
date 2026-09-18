<script lang="ts">
	import type {
		SharedSlotState,
		SlotConfiguration
	} from '$lib/classes/NodeStructureContext.svelte';
	import {
		IconLayoutGrid,
		IconLayoutList,
		IconSettings,
		IconSTurnRight
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FeatureAttributeCard from '$lib/components/FeatureAttributeCard.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import NodeSlotConfigPanel from '$lib/components/node-structure/NodeSlotConfigPanel.svelte';
	import NodeStructurePanel from '$lib/components/node-structure/NodeStructurePanel.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import TrenchProfilePanel from '../trench-profile/TrenchProfilePanel.svelte';
	import MapCableAccordion from './MapCableAccordion.svelte';
	import MapConduitAccordion from './MapConduitAccordion.svelte';
	import { traceFrom } from '../../../../trace/traceUtils';

	interface Props {
		/** Feature properties from MVT */
		featureData?: Record<string, unknown>;
		/** Type of feature ('trench', 'address', 'node') */
		featureType?: string;
		/** UUID of the feature */
		featureId?: string;
		/** Field name alias mapping (English -> Localized) */
		alias?: Record<string, string>;
		/** Project ID of the feature (used in global view) */
		featureProjectId?: string | null;
		/** List of projects for name lookup */
		projects?: Array<{ label: string; value: string; name?: string }>;
	}

	let {
		featureData = {},
		featureType = 'trench',
		featureId = '',
		alias = {},
		featureProjectId = null,
		projects = []
	}: Props = $props();

	let activeTab = $state('attributes');

	let slotConfigPanelOpen = $state(false);
	let structurePanelOpen = $state(false);
	let structurePanelSlotConfigUuid = $state<string | null>(null);

	let trenchProfilePanelOpen = $state(false);

	/** Shared state for slot configurations - keeps both panels in sync */
	let sharedSlotState = $state<SharedSlotState & { lastUpdated: number }>({
		nodeUuid: null,
		slotConfigurations: [] as SlotConfiguration[],
		lastUpdated: 0
	});

	const tabItems = $derived([
		{ value: 'attributes', label: m.common_attributes() },
		...(featureType === 'trench' ? [{ value: 'conduits', label: m.form_conduit_overview() }] : []),
		...(featureType === 'trench' ? [{ value: 'cables', label: m.form_cable_overview() }] : []),
		...(featureType === 'trench' ? [{ value: 'actions', label: m.form_actions() }] : []),
		...(featureType === 'node' ? [{ value: 'actions', label: m.form_actions() }] : []),
		...(featureType === 'address' ? [{ value: 'actions', label: m.form_actions() }] : []),
		{ value: 'files', label: m.form_attachments() }
	]);

	let fileExplorer = $state<{ refresh: () => void } | null>(null);

	/** Refreshes the file explorer after a successful upload. */
	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}

	/**
	 * Opens the node structure panel, optionally pre-selecting a slot configuration.
	 * @param slotConfigUuid - UUID of the slot configuration to display
	 */
	function handleOpenStructurePanel(slotConfigUuid: string | null = null) {
		structurePanelSlotConfigUuid = slotConfigUuid;
		structurePanelOpen = true;
	}
</script>

<Tabs tabs={tabItems} bind:value={activeTab}>
	{#if activeTab === 'attributes'}
		<FeatureAttributeCard properties={featureData} {featureType} {alias} {projects} />
	{/if}

	{#if activeTab === 'conduits' && featureType === 'trench'}
		{#key featureId}
			<QueryBoundary>
				<MapConduitAccordion {featureId} />
			</QueryBoundary>
		{/key}
	{/if}

	{#if activeTab === 'cables' && featureType === 'trench'}
		{#key featureId}
			<QueryBoundary>
				<MapCableAccordion {featureId} />
			</QueryBoundary>
		{/key}
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
			<button
				type="button"
				class="btn preset-filled-tertiary-500 w-full"
				onclick={() => traceFrom('node', featureId)}
			>
				<IconSTurnRight size={18} />
				{m.action_trace()}
			</button>
		</div>
	{/if}

	{#if activeTab === 'actions' && featureType === 'address'}
		<div class="space-y-4">
			<button
				type="button"
				class="btn preset-filled-tertiary-500 w-full"
				onclick={() => traceFrom('address', featureId)}
			>
				<IconSTurnRight size={18} />
				{m.action_trace()}
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
		{#if trenchProfilePanelOpen}
			<QueryBoundary>
				<TrenchProfilePanel trenchUuid={featureId} />
			</QueryBoundary>
		{/if}
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
			nodeName={String(featureData?.name ?? '')}
			readonly={true}
			onViewStructure={(slotConfigUuid: string) => handleOpenStructurePanel(slotConfigUuid)}
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
			nodeName={String(featureData?.name ?? '')}
			readonly={true}
			initialSlotConfigUuid={structurePanelSlotConfigUuid}
			bind:sharedSlotState
		/>
	</FloatingPanel>
{/if}
