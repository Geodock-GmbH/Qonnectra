<script lang="ts">
	import type { EdgeTypes, NodeTypes } from '@xyflow/svelte';
	import type { NetworkSchemaInitData } from '$lib/classes/NetworkSchemaState.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Background, ConnectionMode, Controls, Panel, SvelteFlow } from '@xyflow/svelte';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { NetworkSchemaSearchManager } from '$lib/classes/NetworkSchemaSearchManager.svelte.js';
	import { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import {
		cableDirectionAnimationEnabled,
		edgeSnappingEnabled,
		networkSchemaDisplayOptionsExpanded,
		networkSchemaPanelExpanded,
		selectedProject
	} from '$lib/stores/store';
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';
	import { setSchemaState } from '$lib/context/networkSchemaContext';

	import '@xyflow/svelte/dist/style.css';

	import type { PageData } from './$types';
	import { onMount, setContext } from 'svelte';

	import CableDiagramEdge from '../../components/CableDiagramEdge.svelte';
	import CableDiagramNode from '../../components/CableDiagramNode.svelte';
	import MicroductChoiceDialog from '../../components/MicroductChoiceDialog.svelte';
	import NetworkSchemaSearch from '../../components/NetworkSchemaSearch.svelte';
	import ViewportPersistence from '../../components/ViewportPersistence.svelte';

	let { data }: { data: PageData } = $props();

	// The custom node/edge components declare stricter `data` props than
	// SvelteFlow's generic EdgeProps/NodeProps, so cast the registry to the
	// library types (they are valid flow components at runtime).
	const nodeTypes = { cableDiagramNode: CableDiagramNode } as unknown as NodeTypes;
	const edgeTypes = { cableDiagramEdge: CableDiagramEdge } as unknown as EdgeTypes;

	const connectionMode: ConnectionMode = ConnectionMode.Loose;

	const svelteFlowExtraProps = {
		snapToGrid: true,
		snapGrid: [120, 120] as [number, number],
		connectionRadius: 100,
		noPanClass: 'nopan',
		minZoom: 0.01
	};

	const schemaState = new NetworkSchemaState();
	const searchManager = new NetworkSchemaSearchManager(schemaState);

	$effect(() => {
		schemaState.isChildView = true;
		schemaState.initialize(data as unknown as NetworkSchemaInitData);
		schemaState.parentNodeContext = data.parentNodeId;
	});

	const attributeOptions = $derived({
		nodeTypes: data.nodeTypes,
		cableTypes: data.cableTypes,
		statuses: data.statuses,
		networkLevels: data.networkLevels,
		companies: data.companies,
		flags: data.flags,
		excludedNodeTypeIds: data.excludedNodeTypeIds,
		childViewEnabledNodeTypeIds: data.childViewEnabledNodeTypeIds,
		parentNodeOptions: data.parentNodeOptions ?? []
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
		},
		get parentNodeOptions() {
			return attributeOptions.parentNodeOptions;
		}
	});

	setSchemaState(schemaState);

	onMount(() => {
		autoLockSvelteFlow();
	});

	onMount(() => {
		function handleMicropipeLinkageChanged(event: WindowEventMap['micropipeLinkageChanged']) {
			const { cableId, connections } = event.detail;
			schemaState.updateEdgeMicropipeConnections(cableId, connections);
		}

		window.addEventListener('micropipeLinkageChanged', handleMicropipeLinkageChanged);
		return () => {
			window.removeEventListener('micropipeLinkageChanged', handleMicropipeLinkageChanged);
		};
	});

	function navigateBack() {
		const projectId = $page.params.projectId;
		goto(`/network-schema/${projectId}`);
	}

	let previousDrawerOpen = $state(false);
	$effect(() => {
		const currentDrawerOpen = $drawerStore.open;
		if (previousDrawerOpen && !currentDrawerOpen) {
			schemaState.deselectAllNodes();
		}
		previousDrawerOpen = currentDrawerOpen;
	});
</script>

<svelte:head>
	<title>{m.nav_network_schema()} - {m.action_open_child_network()}</title>
</svelte:head>

<svelte:window
	onkeydown={(e) => schemaState.setShiftFromKeyboard(e)}
	onkeyup={(e) => schemaState.setShiftFromKeyboard(e)}
	onblur={() => schemaState.clearShift()}
/>
<svelte:document onvisibilitychange={() => schemaState.clearShift()} />

<div class="relative flex gap-4 h-full overflow-hidden">
	<div class="flex-1 border-2 rounded-lg border-surface-200-800 h-full">
		<SvelteFlow
			bind:nodes={schemaState.nodes}
			bind:edges={schemaState.edges}
			fitView
			{nodeTypes}
			{edgeTypes}
			{connectionMode}
			{...svelteFlowExtraProps}
			onnodedragstop={(e) => schemaState.handleNodeDragStop(e)}
			onconnect={(conn) => schemaState.handleConnect(conn, $selectedProject)}
		>
			<ViewportPersistence isChildView={true} />
			<Background class="z-0" bgColor="var(--color-surface-100-900)" />
			<Controls />
			<Panel position="top-left">
				<div class="card bg-surface-50-950 p-2 rounded-lg shadow-lg w-72">
					<button
						class="flex items-center gap-1.5 w-full hover:bg-surface-100-800 rounded px-1 py-0.5 transition-colors"
						onclick={() => ($networkSchemaPanelExpanded = !$networkSchemaPanelExpanded)}
					>
						{#if $networkSchemaPanelExpanded}
							<IconChevronDown size={16} class="text-surface-900-100 shrink-0" />
						{:else}
							<IconChevronRight size={16} class="text-surface-900-100 shrink-0" />
						{/if}
						<h1 class="text-lg font-semibold">{m.common_attributes()}</h1>
					</button>

					{#if $networkSchemaPanelExpanded}
						<div class="flex flex-col gap-2 mt-2 pt-2 border-t border-surface-200-800">
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

						<div class="mt-3">
							<button
								class="flex items-center gap-1.5 w-full hover:bg-surface-100-800 rounded px-1 py-0.5 transition-colors"
								onclick={() =>
									($networkSchemaDisplayOptionsExpanded = !$networkSchemaDisplayOptionsExpanded)}
							>
								{#if $networkSchemaDisplayOptionsExpanded}
									<IconChevronDown size={14} class="text-surface-900-100 shrink-0" />
								{:else}
									<IconChevronRight size={14} class="text-surface-900-100 shrink-0" />
								{/if}
								<h3 class="text-sm font-medium">{m.settings_display_options()}</h3>
							</button>

							{#if $networkSchemaDisplayOptionsExpanded}
								<div class="mt-2 space-y-2">
									<div
										class="gap-2 flex items-center justify-between bg-surface-50-900 rounded-lg p-2"
									>
										<span class="text-sm">{m.form_snapping()}</span>
										<Switch
											name="edge-snapping-switch"
											checked={$edgeSnappingEnabled}
											onCheckedChange={() => {
												$edgeSnappingEnabled = !$edgeSnappingEnabled;
											}}
										>
											<Switch.Control>
												<Switch.Thumb />
											</Switch.Control>
											<Switch.HiddenInput />
										</Switch>
									</div>
									<div
										class="gap-2 flex items-center justify-between bg-surface-50-900 rounded-lg p-2"
									>
										<span class="text-sm">{m.settings_cable_direction_animation()}</span>
										<Switch
											name="cable-direction-animation"
											checked={$cableDirectionAnimationEnabled}
											onCheckedChange={() => {
												$cableDirectionAnimationEnabled = !$cableDirectionAnimationEnabled;
											}}
										>
											<Switch.Control>
												<Switch.Thumb />
											</Switch.Control>
											<Switch.HiddenInput />
										</Switch>
									</div>
								</div>
							{/if}
						</div>

						<hr class="hr mt-3" />
						<div class="mt-3">
							<NetworkSchemaSearch {searchManager} {schemaState} />
						</div>
						<button
							type="button"
							class="btn preset-filled-surface-200-800 w-full mt-2"
							onclick={navigateBack}
						>
							<IconArrowLeft size={18} />
							{m.action_back_to_main_schema()}
						</button>
					{/if}
				</div>
			</Panel>
		</SvelteFlow>
	</div>

	<Drawer />
</div>

<MicroductChoiceDialog {schemaState} />

<style>
	:global(path[id^='xy-edge__'].svelte-flow__edge-path) {
		display: none;
	}
</style>
