<script lang="ts">
	import { getPipeBranchState } from './PipeBranchState.svelte';
	import { trenches } from './branchGraph.fixture';

	// Stands in for the panel and drives the shared state the way picking a
	// branch and confirming a trench selection do.
	const branch = getPipeBranchState();
</script>

<p>panel for {branch.projectId}</p>
<button type="button" onclick={() => branch.pickBranch('Node A')}>pick Node A</button>
<button type="button" onclick={() => branch.showOnCanvas('node-a', trenches)}>
	load selection
</button>
<button type="button" onclick={() => branch.setLassoMode(true)}>lasso on</button>
