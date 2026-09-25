<script lang="ts">
	import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
	import type { ComponentProps } from 'svelte';

	import { setSchemaState } from '$lib/context/networkSchemaContext';

	import SchemaDrawerBody from './SchemaDrawerBody.svelte';

	let {
		drawerProps,
		schemaState
	}: {
		drawerProps: ComponentProps<typeof SchemaDrawerBody>;
		schemaState?: Partial<NetworkSchemaState>;
	} = $props();

	// The drawer resolves the schema owner from context to refresh cable
	// details; a minimal stub satisfies it, and tests can pass a richer
	// `schemaState` to observe those calls.
	// svelte-ignore state_referenced_locally
	setSchemaState({
		loadCableDetails: async () => ({}),
		refreshCable: async () => {},
		...schemaState
	} as unknown as NetworkSchemaState);
</script>

<SchemaDrawerBody {...drawerProps} />
