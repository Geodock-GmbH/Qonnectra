<script lang="ts">
	import type { Connection, EdgeTypes, NodeTypes } from '@xyflow/svelte';
	import { Background, ConnectionMode, Controls, Panel, SvelteFlow } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { getConnections } from '$lib/remote/pipe-branch/connections.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import '@xyflow/svelte/dist/style.css';

	import PipeBranchLasso from './lasso/PipeBranchLasso.svelte';
	import PipeBranchEdge from './PipeBranchEdge.svelte';
	import PipeBranchNode from './PipeBranchNode.svelte';
	import PipeBranchPanel from './PipeBranchPanel.svelte';
	import { PipeBranchState, setPipeBranchState } from './PipeBranchState.svelte';
	import TrenchSelection from './trench-selection/TrenchSelection.svelte';
	import { connectionPair, isTargetHandle, toBranchNodes, toConnectionEdges } from './branchGraph';
	import { connectMicroducts } from './connectMicroducts';

	let { projectId }: { projectId: string } = $props();

	// The page re-keys the canvas per project, so the state never outlives its project.
	// svelte-ignore state_referenced_locally
	const branch = setPipeBranchState(new PipeBranchState(projectId));

	const nodeTypes: NodeTypes = { pipeBranch: PipeBranchNode };
	const edgeTypes: EdgeTypes = { pipeBranchEdge: PipeBranchEdge };

	// Written to by SvelteFlow while dragging and selecting; loading another
	// selection lays the conduits out anew.
	let nodes = $derived(toBranchNodes(branch.canvasTrenches));

	// Server truth: every connection write refreshes the query, which redraws the edges.
	let edges = $derived(
		branch.nodeUuid
			? toConnectionEdges(await getConnections(branch.nodeUuid), branch.canvasTrenches)
			: []
	);

	/**
	 * Saves a connection dragged between two handles. Always declines
	 * SvelteFlow's own edge, since the edges are drawn from the saved connections.
	 * @param connection - The connection SvelteFlow proposes.
	 * @returns `false`, so SvelteFlow adds no edge itself.
	 */
	function handleBeforeConnect(connection: Connection): false {
		if (isTargetHandle(connection.sourceHandle)) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_cannot_connect_from_source()
			});
			return false;
		}

		const pair = connectionPair(connection, nodes);
		if (!pair || !branch.nodeUuid) return false;

		if (pair.from.microductUuid === pair.to.microductUuid) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_cannot_connect_microduct_to_itself()
			});
			return false;
		}

		void connectMicroducts(branch.nodeUuid, [pair]);
		return false;
	}
</script>

{#snippet selectionSkeleton()}
	<div
		class="card preset-filled-surface-50-950 p-4 animate-pulse space-y-3 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px]"
		role="status"
	>
		<div class="h-4 w-1/3 rounded bg-surface-200-800"></div>
		<div class="h-4 w-2/3 rounded bg-surface-200-800"></div>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

{#snippet selectionFailed(error: unknown)}
	<div
		class="card preset-filled-error-500 p-4 flex items-center justify-between gap-4 w-[calc(100vw-2rem)] sm:w-auto"
		role="alert"
	>
		<p>{remoteErrorMessage(error) ?? m.message_error_loading_data()}</p>
		<button
			type="button"
			class="btn preset-outlined shrink-0"
			onclick={() => branch.cancelSelection()}
		>
			{m.common_back()}
		</button>
	</div>
{/snippet}

<!-- Opens locked; the lock button in Controls unlocks dragging, connecting and selecting. -->
<SvelteFlow
	bind:nodes
	bind:edges
	fitView
	{nodeTypes}
	{edgeTypes}
	defaultEdgeOptions={{ type: 'pipeBranchEdge' }}
	onbeforeconnect={handleBeforeConnect}
	connectionMode={ConnectionMode.Loose}
	elevateEdgesOnSelect={true}
	elevateNodesOnSelect={false}
	nodesDraggable={false}
	nodesConnectable={false}
	elementsSelectable={false}
	connectionRadius={100}
	connectionLineStyle="stroke: var(--color-surface-50-950); stroke-width: 2px;"
>
	{#if branch.lassoMode}
		<PipeBranchLasso />
	{/if}

	<Panel position="top-left">
		{#if branch.selecting}
			<svelte:boundary pending={selectionSkeleton} failed={selectionFailed}>
				<TrenchSelection />
			</svelte:boundary>
		{:else}
			<PipeBranchPanel />
		{/if}
	</Panel>
	<Background class="z-0" bgColor="var(--color-surface-100-900)" />
	<Controls />
</SvelteFlow>
