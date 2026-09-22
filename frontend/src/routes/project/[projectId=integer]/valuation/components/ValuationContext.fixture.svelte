<script lang="ts">
	import type { ValuationState } from './ValuationState.svelte';
	import type { Component } from 'svelte';

	import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

	import { setValuationState } from './ValuationState.svelte';

	// Supplies the context the valuation page sets, plus a boundary for the
	// component's awaited queries.
	let {
		component,
		props = {},
		valuation
	}: {
		component: Component<never>;
		props?: Record<string, unknown>;
		valuation: ValuationState;
	} = $props();

	// svelte-ignore state_referenced_locally
	setValuationState(valuation);
</script>

<BoundaryFixture {component} {props} />
