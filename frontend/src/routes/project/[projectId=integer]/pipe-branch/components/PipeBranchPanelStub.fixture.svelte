<script lang="ts">
	import { getPipeBranchState } from './PipeBranchState.svelte';
	import { trenches } from './branchGraph.fixture';

	// Stands in for the panel and drives the shared state the way confirming
	// a trench selection and switching the lasso do.
	const branch = getPipeBranchState();
</script>

<p>panel for {branch.projectId}</p>
<button type="button" onclick={() => branch.showOnCanvas(trenches)}>load selection</button>
<button type="button" onclick={() => branch.setLassoMode(true)}>lasso on</button>
