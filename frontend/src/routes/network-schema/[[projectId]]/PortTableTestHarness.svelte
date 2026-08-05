<script>
	import { setContext } from 'svelte';

	import { NODE_STRUCTURE_CONTEXT_KEY } from '$lib/classes/NodeStructureContext.svelte.js';

	import PortTable from './PortTable.svelte';

	let { context = null, ...rest } = $props();

	setContext(NODE_STRUCTURE_CONTEXT_KEY, context);
</script>

<PortTable {...rest} />
