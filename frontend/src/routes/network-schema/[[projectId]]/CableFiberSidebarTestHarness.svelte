<script>
	import { setContext } from 'svelte';

	import { DRAG_DROP_CONTEXT_KEY } from '$lib/classes/DragDropManager.svelte';

	import CableFiberSidebar from './CableFiberSidebar.svelte';

	let { dragDropManager = null, ...rest } = $props();

	setContext(DRAG_DROP_CONTEXT_KEY, dragDropManager);
</script>

<CableFiberSidebar {...rest} />
