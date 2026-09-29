<script lang="ts">
	import type { ProfileNode } from './profileNodes';

	// Stands in for SvelteFlow: lists the nodes it was given and exposes the
	// drag and resize callbacks as buttons, since jsdom cannot drive the canvas.
	let {
		nodes = $bindable([]),
		onnodedragstop,
		onnodeschange
	}: {
		nodes: ProfileNode[];
		onnodedragstop: (event: { targetNode: ProfileNode | null }) => void;
		onnodeschange: (
			changes: Array<{
				type: string;
				id: string;
				resizing: boolean;
				dimensions: { width: number; height: number };
			}>
		) => void;
	} = $props();
</script>

<ul>
	{#each nodes as node (node.id)}
		<li>{node.data.conduit.conduit_name}</li>
	{/each}
</ul>
<button
	type="button"
	onclick={() =>
		onnodedragstop({
			targetNode: { ...nodes[0], position: { x: 30, y: 40 }, measured: { width: 90, height: 70 } }
		})}
>
	drag first node
</button>
<button type="button" onclick={() => onnodedragstop({ targetNode: null })}>drag nothing</button>
<button
	type="button"
	onclick={() =>
		onnodeschange([
			{
				type: 'dimensions',
				id: nodes[0].id,
				resizing: false,
				dimensions: { width: 120, height: 110 }
			}
		])}
>
	resize first node
</button>
