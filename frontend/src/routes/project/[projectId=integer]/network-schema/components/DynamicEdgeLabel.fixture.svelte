<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
	import { setSchemaState } from '$lib/context/networkSchemaContext';

	import DynamicEdgeLabel from './DynamicEdgeLabel.svelte';

	let {
		labelProps,
		schemaState
	}: {
		labelProps: ComponentProps<typeof DynamicEdgeLabel>;
		schemaState?: Partial<NetworkSchemaState>;
	} = $props();

	// Use a real NetworkSchemaState so the production `isEditing`/edit-mode logic
	// is exercised (not a reimplemented stub). The default is "editing the label's
	// own cable" (unlocked + editingCableId matching the fixture's edge) so the
	// edit-path tests hit the live gestures; passing `{ locked: true }` or a
	// different `editingCableId` reproduces the non-editing paths. `loadCableDetails`
	// is stubbed by default and overridable per test.
	// svelte-ignore state_referenced_locally
	const state = new NetworkSchemaState();
	// svelte-ignore state_referenced_locally
	state.locked = false;
	// svelte-ignore state_referenced_locally
	state.editingCableId = labelProps.edgeId;
	// svelte-ignore state_referenced_locally
	state.loadCableDetails = async () => ({}) as Awaited<ReturnType<typeof state.loadCableDetails>>;
	// svelte-ignore state_referenced_locally
	Object.assign(state, schemaState);

	setSchemaState(state);
</script>

<svg data-testid="label-svg">
	<DynamicEdgeLabel {...labelProps} />
</svg>
