<script lang="ts">
	import type { TrenchAssignmentState } from './TrenchAssignmentState.svelte';
	import type { TrenchMapManagers } from './trenchMapContext';
	import type { Component } from 'svelte';

	import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

	import { setTrenchAssignment } from './TrenchAssignmentState.svelte';
	import { setTrenchMapManagers } from './trenchMapContext';

	// Supplies the contexts the trench page sets, plus a boundary for the
	// component's awaited queries.
	let {
		component,
		props = {},
		assignment,
		managers
	}: {
		component: Component<never>;
		props?: Record<string, unknown>;
		assignment: TrenchAssignmentState;
		managers: TrenchMapManagers;
	} = $props();

	// svelte-ignore state_referenced_locally
	setTrenchAssignment(assignment);
	// svelte-ignore state_referenced_locally
	setTrenchMapManagers(managers);
</script>

<BoundaryFixture {component} {props} />
