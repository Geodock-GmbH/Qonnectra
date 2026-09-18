<script lang="ts">
	import type { NodeStructureContext } from '$lib/classes/NodeStructureContext.svelte.js';
	import { setContext, untrack } from 'svelte';

	import { NODE_STRUCTURE_CONTEXT_KEY } from '$lib/classes/NodeStructureContext.svelte.js';

	import PortTable from './PortTable.svelte';

	let {
		context = null,
		...rest
	}: { context?: NodeStructureContext | null; [key: string]: unknown } = $props();

	setContext(
		NODE_STRUCTURE_CONTEXT_KEY,
		untrack(() => context)
	);
</script>

<PortTable {...rest} />
