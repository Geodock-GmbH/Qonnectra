<script lang="ts">
	import type { Component } from 'svelte';
	import { setContext } from 'svelte';

	import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

	// Supplies the `mapManagers` context the map page sets, plus a boundary
	// for the component's awaited queries.
	let {
		component,
		props,
		selectionManager
	}: {
		component: Component<never>;
		props: Record<string, unknown>;
		selectionManager: { selectMultipleFeatures: (featureIds: string[]) => void };
	} = $props();

	// svelte-ignore state_referenced_locally
	setContext('mapManagers', { selectionManager });
</script>

<BoundaryFixture {component} {props} />
