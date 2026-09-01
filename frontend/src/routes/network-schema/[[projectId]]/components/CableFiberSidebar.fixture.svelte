<script lang="ts">
	import type { DragDropManager } from '$lib/classes/DragDropManager.svelte';
	import type { ComponentProps } from 'svelte';
	import { setContext, untrack } from 'svelte';

	import { DRAG_DROP_CONTEXT_KEY } from '$lib/classes/DragDropManager.svelte';

	import CableFiberSidebar from './CableFiberSidebar.svelte';

	let {
		dragDropManager = null,
		...rest
	}: { dragDropManager?: DragDropManager | null } & ComponentProps<typeof CableFiberSidebar> =
		$props();

	setContext(
		DRAG_DROP_CONTEXT_KEY,
		untrack(() => dragDropManager)
	);
</script>

<CableFiberSidebar {...rest} />
