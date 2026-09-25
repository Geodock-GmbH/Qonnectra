<script lang="ts">
	import type { Fiber } from '$lib/classes/CableFiberDataManager.svelte';
	import type {
		AttributeOptions,
		CableDrawerProps,
		NodeDrawerProps
	} from '$lib/types/attributeCardTypes';
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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
	import Tabs from '$lib/components/Tabs.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { queryEnum, setQuery } from '$lib/utils/urlState';
	import { isNetworkSchemaChildView } from '$lib/config/routes';
	import { getSchemaPanels, getSchemaState } from '$lib/context/networkSchemaContext';
	import { routeProjectId } from '$lib/context/project';
	import {
		getCableDetails,
		recalculateCableLength
	} from '$lib/remote/network-schema/cables.remote';
	import { getNodeDetails } from '$lib/remote/network-schema/nodes.remote';

	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

	/** Feature kinds the network-schema drawer can show, as named in `?feature=kind:id`. */
	export type SchemaFeatureKind = 'node' | 'cable';

	interface DrawerTabsProps {
		/** The feature kind named in the URL. */
		kind: SchemaFeatureKind;
		/** The node or cable uuid named in the URL. */
		id: string;
		/** The drawer header, reported up once the record is known and after a rename. */
		title?: string;
	}

	const attributeOptions = getContext<AttributeOptions>('attributeOptions');
	const schemaState = getSchemaState();
	const panels = getSchemaPanels();

	const fiberDataManager = new CableFiberDataManager();

	let { kind, id, title = $bindable('') }: DrawerTabsProps = $props();

	/**
	 * The record lives in the remote query cache, the single source for the
	 * drawer: a refresh of the query updates every card. A node detail is a
	 * GeoJSON feature, so its fields sit under `properties`.
	 * @param raw - The detail payload.
	 */
	function recordOf(raw: Record<string, unknown>): CableDrawerProps | NodeDrawerProps {
		if (kind === 'cable') return raw as CableDrawerProps;
		return {
			id,
			...((raw.properties as Record<string, unknown> | undefined) ?? {})
		} as NodeDrawerProps;
	}

	const detailsQuery = $derived(kind === 'cable' ? getCableDetails(id) : getNodeDetails(id));

	// The drawer body re-keys this component per feature, so the first load names
	// the drawer once; renames report through `onLabelUpdate`.
	// svelte-ignore state_referenced_locally
	title = String(recordOf(await detailsQuery).name ?? '');

	const data = $derived(recordOf(await detailsQuery));
	const type = $derived(kind === 'cable' ? 'edge' : 'node');

	const isChildView = $derived(isNetworkSchemaChildView(page.route.id));
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
		goto(
			resolve('/project/[projectId=integer]/network-schema/node/[nodeId]', {
				projectId: routeProjectId(),
				nodeId: id
			})
		);
	}

	/**
	 * A rename in a card: the drawer header and the canvas label follow.
	 * @param name - The saved name.
	 */
	function onLabelUpdate(name: string) {
		title = name;
		if (kind === 'cable') schemaState.updateEdgeName(id, name);
		else schemaState.updateNodeName(id, name);
	}

	/** A deleted cable leaves the canvas; the card already closed the drawer by URL. */
	function onEdgeDelete(uuid: string) {
		schemaState.handleEdgeDelete(uuid);
	}

	/** A deleted node leaves the canvas; the card already closed the drawer by URL. */
	function onNodeDelete(nodeId: string) {
		schemaState.handleNodeDelete(nodeId);
	}

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

	// The tab lives in the URL; a tab this kind does not offer falls back to
	// the attributes, and the default is never written.
	const group = $derived(
		queryEnum(
			page.url,
			'tab',
			tabItems.map((tab) => tab.value),
			'attributes'
		)
	);

	/**
	 * Loads what the status tab shows. Every fetch is cached in the manager, so
	 * calling this on each visit only hits the server the first time.
	 */
	function loadFiberStatus() {
		if (type !== 'edge') return;
		fiberDataManager.fetchFibersForCable(featureId);
		fiberDataManager.fetchFiberColors();
		fiberDataManager.fetchFiberStatusOptions();
	}

	/**
	 * Handles tab change events, lazily loading fiber data when the status tab is selected.
	 * @param newValue - The newly selected tab value.
	 */
	function handleTabChange(newValue: string) {
		if (newValue === 'status') loadFiberStatus();
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

	const featureId = $derived(id);

	// A tab change rewrites the history entry and the drawer body re-keys this component
	// per feature, so a status tab present at mount is the only one not opened by click.
	onMount(() => {
		if (group === 'status') loadFiberStatus();
		return () => fiberDataManager.cleanup();
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
	 * Triggers a server-side recalculation of the cable's routed length and refreshes the cable data on success.
	 */
	async function handleRecalculateLength() {
		if (!featureId || recalculating) return;
		recalculating = true;
		try {
			await recalculateCableLength(featureId);
			globalToaster.success({
				title: m.message_cable_length_recalculated(),
				duration: 3000
			});
			await refreshCableData();
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
	 * Refreshes the cable record, which updates every card awaiting the query,
	 * and the edge's micropipe coloring.
	 */
	async function refreshCableData() {
		if (type !== 'edge' || !featureId) return;
		await schemaState.refreshCable(featureId);
	}
</script>

<Tabs
	tabs={tabItems}
	value={group}
	onValueChange={(tab) => {
		handleTabChange(tab);
		setQuery({ tab });
	}}
>
	{#if group === 'attributes'}
		{#if type === 'edge'}
			<CableDiagramEdgeAttributeCard
				cable={data as CableDrawerProps}
				{onLabelUpdate}
				{onEdgeDelete}
				onSaveComplete={refreshCableData}
			/>
		{:else if type === 'node'}
			<CableDiagramNodeAttributeCard
				node={data as NodeDrawerProps}
				{onLabelUpdate}
				{onNodeDelete}
			/>
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
		<CableDiagramEdgeHandleConfig
			cable={data as CableDrawerProps}
			onConnectionChange={refreshCableData}
		/>
	{/if}

	{#if group === 'actions'}
		{#if type === 'node'}
			<div class="space-y-4">
				<button
					type="button"
					class="btn preset-filled-primary-500 w-full"
					onclick={() => (panels.slotConfigOpen = true)}
				>
					<IconSettings size={18} />
					{m.action_configure_slots()}
				</button>
				<button
					type="button"
					class="btn preset-filled-secondary-500 w-full"
					onclick={() => panels.openStructure(id)}
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
					onclick={() => (panels.micropipeOpen = true)}
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
