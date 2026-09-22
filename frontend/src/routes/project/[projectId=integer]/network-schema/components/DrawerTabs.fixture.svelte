<script lang="ts">
	import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
	import type { ComponentProps } from 'svelte';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { setSchemaState } from '$lib/context/networkSchemaContext';

	import DrawerTabs from './DrawerTabs.svelte';

	let {
		drawerProps,
		schemaState
	}: {
		drawerProps: ComponentProps<typeof DrawerTabs>;
		schemaState?: Partial<NetworkSchemaState>;
	} = $props();

	// DrawerTabs resolves the schema owner from context to refresh cable
	// details; a minimal stub satisfies it, and tests can pass a richer
	// `schemaState` to observe those calls.
	// svelte-ignore state_referenced_locally
	setSchemaState({
		loadCableDetails: async () => ({}),
		...schemaState
	} as unknown as NetworkSchemaState);
</script>

<!-- The tabs await the feature's record, so a boundary hosts them like the page does. -->
<QueryBoundary>
	<DrawerTabs {...drawerProps} />
</QueryBoundary>
