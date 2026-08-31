<script lang="ts">
	import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
	import type { ComponentProps } from 'svelte';

	import { setSchemaState } from '$lib/context/networkSchemaContext';

	import CableDiagramEdge from './CableDiagramEdge.svelte';

	let {
		edgeProps,
		schemaState
	}: {
		edgeProps: ComponentProps<typeof CableDiagramEdge>;
		schemaState: NetworkSchemaState;
	} = $props();

	// Test-only: the state instance is passed once and never reassigned.
	// svelte-ignore state_referenced_locally
	setSchemaState(schemaState);
</script>

<svg data-testid="edge-svg">
	<CableDiagramEdge {...edgeProps} />
</svg>
