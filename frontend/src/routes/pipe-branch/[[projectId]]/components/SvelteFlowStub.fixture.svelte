<script lang="ts">
	import type { BranchEdge, BranchNode } from './branchGraph';
	import type { Connection } from '@xyflow/svelte';
	import type { Snippet } from 'svelte';

	// Stands in for SvelteFlow: lists the nodes and edges it was given and
	// offers the connections a user could drag as buttons, since jsdom cannot
	// drive the canvas. Shows whether the canvas accepted SvelteFlow's own edge.
	let {
		nodes = $bindable([]),
		edges = $bindable([]),
		onbeforeconnect,
		nodesConnectable,
		children
	}: {
		nodes: BranchNode[];
		edges: BranchEdge[];
		onbeforeconnect: (connection: Connection) => Connection | false;
		nodesConnectable: boolean;
		children: Snippet;
	} = $props();

	const SOURCE = 'trench-t1-conduit-c1';
	const TARGET = 'trench-t2-conduit-c2';

	const drags: Record<string, Connection> = {
		'drag m2 to m3': {
			source: SOURCE,
			sourceHandle: 'conduit-c1-microduct-2-source',
			target: TARGET,
			targetHandle: 'conduit-c2-microduct-1-target'
		},
		'drag from a target handle': {
			source: SOURCE,
			sourceHandle: 'conduit-c1-microduct-2-target',
			target: TARGET,
			targetHandle: 'conduit-c2-microduct-1-target'
		},
		'drag m2 onto itself': {
			source: SOURCE,
			sourceHandle: 'conduit-c1-microduct-2-source',
			target: SOURCE,
			targetHandle: 'conduit-c1-microduct-2-target'
		}
	};

	let ownEdge = $state('none');
</script>

<div data-testid="svelte-flow" data-connectable={nodesConnectable}>
	<ul aria-label="nodes">
		{#each nodes as node (node.id)}
			<li>{node.id}</li>
		{/each}
	</ul>
	<ul aria-label="edges">
		{#each edges as edge (edge.id)}
			<li>{edge.id}</li>
		{/each}
	</ul>
	{#each Object.entries(drags) as [name, connection] (name)}
		<button
			type="button"
			onclick={() => (ownEdge = onbeforeconnect(connection) ? 'added' : 'declined')}
		>
			{name}
		</button>
	{/each}
	<p>own edge: {ownEdge}</p>
	{@render children()}
</div>
