<script lang="ts">
	import type { PipeBranchState } from './PipeBranchState.svelte';
	import type { Component } from 'svelte';

	import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

	import { setPipeBranchState } from './PipeBranchState.svelte';

	// Supplies the state the pipe-branch canvas sets, plus a boundary for the
	// component's awaited queries.
	let {
		component,
		props = {},
		branch
	}: {
		component: Component<never>;
		props?: Record<string, unknown>;
		branch: PipeBranchState;
	} = $props();

	// svelte-ignore state_referenced_locally
	setPipeBranchState(branch);
</script>

<BoundaryFixture {component} {props} />
