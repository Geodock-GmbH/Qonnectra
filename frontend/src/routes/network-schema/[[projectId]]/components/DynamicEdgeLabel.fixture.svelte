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

	// The label reads `shiftPressed`/`locked` off the state and calls
	// `loadCableDetails` when opening the drawer; a minimal stub satisfies these,
	// and tests can pass a richer `schemaState` (e.g. `locked: true`) to observe
	// the drawer-open path or the locked behavior.
	// svelte-ignore state_referenced_locally
	setSchemaState({
		shiftPressed: false,
		locked: false,
		loadCableDetails: async () => ({}),
		...schemaState
	} as unknown as NetworkSchemaState);
</script>

<svg data-testid="label-svg">
	<DynamicEdgeLabel {...labelProps} />
</svg>
