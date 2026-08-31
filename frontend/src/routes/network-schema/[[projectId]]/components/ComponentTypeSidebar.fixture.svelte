<script lang="ts">
	import type { DragDropManager } from '$lib/classes/DragDropManager.svelte';
	import { setContext, untrack } from 'svelte';

	import { DRAG_DROP_CONTEXT_KEY } from '$lib/classes/DragDropManager.svelte';

	import ComponentTypeSidebar from './ComponentTypeSidebar.svelte';

	let {
		dragDropManager = null,
		...rest
	}: { dragDropManager?: Partial<DragDropManager> | null; [key: string]: unknown } = $props();

	setContext(
		DRAG_DROP_CONTEXT_KEY,
		untrack(() => dragDropManager)
	);
</script>

<ComponentTypeSidebar {...rest} />
