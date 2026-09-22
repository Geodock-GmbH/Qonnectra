<script lang="ts">
	import type {
		SharedSlotState,
		SlotConfiguration
	} from '$lib/classes/NodeStructureContext.svelte';
	import type { MapFeatureKind } from '$lib/map/featureDetails';
	import { page } from '$app/state';
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
	import { displayProperties, featureTitle } from '$lib/map/featureDetails';
	import { traceFrom } from '$lib/utils/traceUtils';
	import { queryEnum, setQuery } from '$lib/utils/urlState';
	import { getFeatureDetails } from '$lib/remote/map/feature-search.remote';
	import { getConduitsInTrench } from '$lib/remote/map/trenches.remote';

	import TrenchProfilePanel from '../trench-profile/TrenchProfilePanel.svelte';
	import MapCableAccordion from './MapCableAccordion.svelte';
	import MapConduitAccordion from './MapConduitAccordion.svelte';

	interface Props {
		/** The feature kind named in the URL. */
		kind: MapFeatureKind;
		/** The feature uuid named in the URL. */
		uuid: string;
		/** Project to look the feature up in; empty in the global view. */
		lookupProjectId?: string;
		/** Field name alias mapping (English -> Localized) */
		alias?: Record<string, string>;
		/** List of projects for name lookup */
		projects?: Array<{ label: string; value: string; name?: string }>;
		/** The drawer header, reported up once the feature is known. */
		title?: string;
	}

	let {
		kind,
		uuid,
		lookupProjectId = '',
		alias = {},
		projects = [],
		title = $bindable('')
	}: Props = $props();

	// The page re-keys this component per feature, so the details load once
	// per drawer. The conduit names come from the tile layer today and are
	// not part of the detail payload, hence the second query for trenches.
	// svelte-ignore state_referenced_locally
	const [feature, conduits] = await Promise.all([
		getFeatureDetails({ featureType: kind, featureUuid: uuid, projectId: lookupProjectId }),
		kind === 'trench' ? getConduitsInTrench(uuid) : Promise.resolve([])
	]);
	// svelte-ignore state_referenced_locally
	const featureData = displayProperties(kind, feature.properties, {
		conduitNames: conduits.flatMap((item) => (item.conduit?.name ? [item.conduit.name] : []))
	});
	// svelte-ignore state_referenced_locally
	title = featureTitle(kind, featureData);
	const featureName = String(featureData.name ?? '');

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

	// The kind is fixed for this instance, so the tab list is built once.
	/* svelte-ignore state_referenced_locally */
	const tabItems = [
		{ value: 'attributes', label: m.common_attributes() },
		...(kind === 'trench' ? [{ value: 'conduits', label: m.form_conduit_overview() }] : []),
		...(kind === 'trench' ? [{ value: 'cables', label: m.form_cable_overview() }] : []),
		...(kind !== 'area' ? [{ value: 'actions', label: m.form_actions() }] : []),
		{ value: 'files', label: m.form_attachments() }
	];

	// The tab lives in the URL; a tab this kind does not offer falls back to
	// the attributes, and the default is never written.
	const activeTab = $derived(
		queryEnum(
			page.url,
			'tab',
			tabItems.map((tab) => tab.value),
			'attributes'
		)
	);

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

<Tabs tabs={tabItems} value={activeTab} onValueChange={(tab) => setQuery({ tab })}>
	{#if activeTab === 'attributes'}
		<FeatureAttributeCard properties={featureData} featureType={kind} {alias} {projects} />
	{/if}

	{#if activeTab === 'conduits' && kind === 'trench'}
		<QueryBoundary>
			<MapConduitAccordion featureId={uuid} />
		</QueryBoundary>
	{/if}

	{#if activeTab === 'cables' && kind === 'trench'}
		<QueryBoundary>
			<MapCableAccordion featureId={uuid} />
		</QueryBoundary>
	{/if}

	{#if activeTab === 'actions' && kind === 'trench'}
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

	{#if activeTab === 'actions' && kind === 'node'}
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
				onclick={() => traceFrom('node', uuid)}
			>
				<IconSTurnRight size={18} />
				{m.action_trace()}
			</button>
		</div>
	{/if}

	{#if activeTab === 'actions' && kind === 'address'}
		<div class="space-y-4">
			<button
				type="button"
				class="btn preset-filled-tertiary-500 w-full"
				onclick={() => traceFrom('address', uuid)}
			>
				<IconSTurnRight size={18} />
				{m.action_trace()}
			</button>
		</div>
	{/if}

	{#if activeTab === 'files'}
		<div class="space-y-4">
			<FileUpload featureType={kind} featureId={uuid} onUploadComplete={handleUploadComplete} />
			<FileExplorer bind:this={fileExplorer} featureType={kind} featureId={uuid} />
		</div>
	{/if}
</Tabs>

{#if kind === 'trench'}
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
				<TrenchProfilePanel trenchUuid={uuid} />
			</QueryBoundary>
		{/if}
	</FloatingPanel>
{/if}

{#if kind === 'node'}
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
			nodeUuid={uuid}
			nodeName={featureName}
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
			nodeUuid={uuid}
			nodeName={featureName}
			readonly={true}
			initialSlotConfigUuid={structurePanelSlotConfigUuid}
			bind:sharedSlotState
		/>
	</FloatingPanel>
{/if}
