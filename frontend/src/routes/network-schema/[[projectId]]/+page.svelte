<script>
	import { page } from '$app/stores';
	import { Background, Controls, Panel, SvelteFlow } from '@xyflow/svelte';
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import { CablePathManager } from '$lib/classes/CablePathManager.svelte.js';
	import { NetworkSchemaSearchManager } from '$lib/classes/NetworkSchemaSearchManager.svelte.js';
	import { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte.js';
	import Drawer from '$lib/components/Drawer.svelte';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { edgeSnappingEnabled, selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';
	import { startHeartbeat, stopHeartbeat } from '$lib/utils/tokenHeartbeat.svelte.js';

	import '@xyflow/svelte/dist/style.css';

	import { onMount, setContext } from 'svelte';

	import CableDiagramEdge from './CableDiagramEdge.svelte';
	import CableDiagramNode from './CableDiagramNode.svelte';
	import NetworkSchemaSearch from './NetworkSchemaSearch.svelte';
	import ViewportPersistence from './ViewportPersistence.svelte';

	let { data } = $props();

	const nodeTypes = { cableDiagramNode: CableDiagramNode };
	const edgeTypes = { cableDiagramEdge: CableDiagramEdge };

	// Create managers - schemaState initialized reactively via $effect
	const schemaState = new NetworkSchemaState();
	const cablePathManager = new CablePathManager();
	const searchManager = new NetworkSchemaSearchManager(schemaState);

	let prevUrl = $state($page.url.href);

	// Initialize schema state when data is available
	$effect(() => {
		schemaState.isChildView = false;
		schemaState.initialize(data);
	});

	// Context with derived attribute options - stays reactive to data changes
	const attributeOptions = $derived({
		nodeTypes: data.nodeTypes,
		cableTypes: data.cableTypes,
		statuses: data.statuses,
		networkLevels: data.networkLevels,
		companies: data.companies,
		flags: data.flags,
		excludedNodeTypeIds: data.excludedNodeTypeIds,
		childViewEnabledNodeTypeIds: data.childViewEnabledNodeTypeIds
	});

	setContext('attributeOptions', {
		get nodeTypes() {
			return attributeOptions.nodeTypes;
		},
		get cableTypes() {
			return attributeOptions.cableTypes;
		},
		get statuses() {
			return attributeOptions.statuses;
		},
		get networkLevels() {
			return attributeOptions.networkLevels;
		},
		get companies() {
			return attributeOptions.companies;
		},
		get flags() {
			return attributeOptions.flags;
		},
		get excludedNodeTypeIds() {
			return attributeOptions.excludedNodeTypeIds;
		},
		get childViewEnabledNodeTypeIds() {
			return attributeOptions.childViewEnabledNodeTypeIds;
		}
	});

	setContext('schemaState', {
		get nodes() {
			return schemaState.nodes;
		}
	});

	/**
	 * Initialize component and check sync status
	 */
	onMount(async () => {
		startHeartbeat();
		await autoLockSvelteFlow();

		if (!data.networkSchemaSettingsConfigured && $selectedProject) {
			globalToaster.warning({
				title: m.common_warning(),
				description: m.message_network_schema_settings_not_configured()
			});
		}

		if (data.syncStatus) {
			if (data.syncStatus.sync_status === 'FAILED') {
				globalToaster.error({
					title: m.title_error_canvas_sync_failed(),
					description: data.syncStatus.error_message || m.message_error_canvas_sync_failed()
				});
			} else if (data.syncStatus.sync_status === 'COMPLETED') {
				globalToaster.success({
					title: m.title_success_canvas_sync_complete()
				});
			}
		}

		return () => {
			stopHeartbeat();
		};
	});

	/**
	 * Reload page when URL changes (project switch)
	 */
	$effect(() => {
		if ($page.url.href !== prevUrl) {
			prevUrl = $page.url.href;
			window.location.reload();
		}
	});

	/**
	 * Listen for micropipe linkage changes to update edge colors
	 */
	onMount(() => {
		function handleMicropipeLinkageChanged(event) {
			const { cableId, connections } = event.detail;
			schemaState.updateEdgeMicropipeConnections(cableId, connections);
		}

		window.addEventListener('micropipeLinkageChanged', handleMicropipeLinkageChanged);
		return () => {
			window.removeEventListener('micropipeLinkageChanged', handleMicropipeLinkageChanged);
		};
	});

	/**
	 * Handle cable path update events from CableDiagramEdge
	 */
	async function handleCablePathUpdate(event) {
		const { edgeId, waypoints, temporary, save } = event.detail;

		await cablePathManager.updatePath(edgeId, waypoints, temporary, save, (edgeId, updates) => {
			schemaState.edges = schemaState.edges.map((edge) => {
				if (edge.id === edgeId) {
					return {
						...edge,
						data: {
							...edge.data,
							cable: {
								...edge.data.cable,
								...updates.data.cable
							}
						}
					};
				}
				return edge;
			});
		});
	}

	/**
	 * Handle cable handle updates from CableDiagramEdge
	 */
	function handleCableHandleUpdate(event) {
		const { cableId, handleStart, handleEnd } = event.detail;
		cablePathManager.updateHandles(
			cableId,
			handleStart,
			handleEnd,
			(cableId, handleStart, handleEnd) => {
				schemaState.updateCableHandles(cableId, handleStart, handleEnd);
			}
		);
	}

	/**
	 * Listen for cable path update events
	 */
	$effect(() => {
		window.addEventListener('updateCablePath', handleCablePathUpdate);
		return () => {
			window.removeEventListener('updateCablePath', handleCablePathUpdate);
		};
	});

	/**
	 * Listen for cable handle update events
	 */
	$effect(() => {
		window.addEventListener('updateCableHandles', handleCableHandleUpdate);
		return () => {
			window.removeEventListener('updateCableHandles', handleCableHandleUpdate);
		};
	});

	/**
	 * Listen for cable connection changed events (from handle config reconnection)
	 */
	$effect(() => {
		function handleCableConnectionChangedEvent(event) {
			const { cableId, side, newNodeId, handlePosition } = event.detail;
			// If this is an edge reconnection event (has cableId and side), update the edge
			if (cableId && side && newNodeId) {
				schemaState.updateEdgeConnection(cableId, side, newNodeId, handlePosition);
			}
		}

		window.addEventListener('cableConnectionChanged', handleCableConnectionChangedEvent);
		return () => {
			window.removeEventListener('cableConnectionChanged', handleCableConnectionChangedEvent);
		};
	});

	/**
	 * Track drawer state and deselect nodes when drawer closes
	 */
	let previousDrawerOpen = $state(false);
	$effect(() => {
		const currentDrawerOpen = $drawerStore.open;

		// Detect drawer closing (transition from open to closed)
		if (previousDrawerOpen && !currentDrawerOpen) {
			schemaState.deselectAllNodes();
		}

		previousDrawerOpen = currentDrawerOpen;
	});
</script>

<svelte:head>
	<title>{m.nav_network_schema()}</title>
</svelte:head>

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 border-2 rounded-lg border-surface-200-800 h-full">
		<SvelteFlow
			bind:nodes={schemaState.nodes}
			bind:edges={schemaState.edges}
			fitView={schemaState.initialized && schemaState.nodes.length === 0}
			{nodeTypes}
			{edgeTypes}
			connectionMode="loose"
			snapToGrid={true}
			snapGrid={[120, 120]}
			onnodedragstop={(e) => schemaState.handleNodeDragStop(e)}
			onconnect={(conn) => schemaState.handleConnect(conn, $selectedProject)}
			connectionRadius={100}
			noPanClass="nopan"
			minZoom={0.01}
		>
			<ViewportPersistence />
			<Background class="z-0" bgColor="var(--color-surface-100-900) " />
			<Controls />
			<Panel position="top-left">
				<div class="card bg-surface-50-950 p-2 rounded-lg shadow-lg w-72">
					<h1 class="text-lg font-semibold mb-1">{m.common_attributes()}</h1>
					<div class="flex flex-col gap-2">
						<label for="cable_name_input" class="text-sm font-medium">
							<input
								class="input"
								type="text"
								placeholder={m.common_name()}
								bind:value={schemaState.userCableName}
							/>
						</label>

						<GenericCombobox
							data={schemaState.cableTypes}
							bind:value={schemaState.selectedCableType}
							defaultValue={schemaState.selectedCableType}
							placeholder={m.placeholder_select_cable_type()}
							onValueChange={(e) => {
								schemaState.selectedCableType = e.value;
							}}
							contentBase="preset-filled-surface-50-950 max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 shadow-lg"
						/>
					</div>

					<div
						class="gap-2 flex items-center justify-between bg-surface-50-900 rounded-lg p-2 mt-2"
					>
						<h3 class="text-sm font-medium">{m.form_snapping()}</h3>
						<Switch
							name="edge-snapping-switch"
							checked={$edgeSnappingEnabled}
							onCheckedChange={(e) => {
								$edgeSnappingEnabled = e.checked;
							}}
						>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
							<Switch.HiddenInput />
						</Switch>
					</div>
					<hr class="hr" />
					<div class="mt-3">
						<NetworkSchemaSearch {searchManager} {schemaState} />
					</div>
				</div>
			</Panel>
		</SvelteFlow>
	</div>

	<Drawer />
</div>

<style>
	:global(path[id^='xy-edge__'].svelte-flow__edge-path) {
		display: none;
	}
</style>
