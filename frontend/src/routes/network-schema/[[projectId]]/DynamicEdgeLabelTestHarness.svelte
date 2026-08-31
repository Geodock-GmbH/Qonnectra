<script lang="ts">
	import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
	import type { ComponentProps } from 'svelte';

	import { setSchemaState } from '$lib/context/networkSchemaContext';

	import DynamicEdgeLabel from './DynamicEdgeLabel.svelte';

	let {
		labelProps,
		schemaState
	}: {
		labelProps: ComponentProps<typeof DynamicEdgeLabel>;
		schemaState?: Partial<NetworkSchemaState>;
	} = $props();

	// The label reads `shiftPressed` off the state and calls `loadCableDetails`
	// when opening the drawer; a minimal stub satisfies both, and tests can pass
	// a richer `schemaState` to observe the drawer-open path.
	// svelte-ignore state_referenced_locally
	setSchemaState({
		shiftPressed: false,
		loadCableDetails: async () => ({}),
		...schemaState
	} as unknown as NetworkSchemaState);
</script>

<svg data-testid="label-svg">
	<DynamicEdgeLabel {...labelProps} />
</svg>
