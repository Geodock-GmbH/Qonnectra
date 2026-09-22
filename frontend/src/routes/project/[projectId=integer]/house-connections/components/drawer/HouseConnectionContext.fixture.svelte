<script lang="ts">
	import type { HouseConnectionInteraction } from '../houseConnectionContext';
	import type { Component } from 'svelte';

	import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

	import { setHouseConnectionInteraction } from '../houseConnectionContext';

	// Supplies the interaction context the house-connections page sets, plus a boundary
	// for the component's awaited queries.
	let {
		component,
		props,
		context
	}: {
		component: Component<never>;
		props: Record<string, unknown>;
		context: HouseConnectionInteraction;
	} = $props();

	// svelte-ignore state_referenced_locally
	setHouseConnectionInteraction(context);
</script>

<BoundaryFixture {component} {props} />
