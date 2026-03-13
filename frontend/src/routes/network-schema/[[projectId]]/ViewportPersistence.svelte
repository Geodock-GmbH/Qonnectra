<script>
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';

	import { networkSchemaChildViewport, networkSchemaViewport } from '$lib/stores/store';

	let { isChildView = false } = $props();

	const viewportStore = $derived(
		/** @type {any} */ (isChildView) ? networkSchemaChildViewport : networkSchemaViewport
	);

	const { getViewport, setViewport } = useSvelteFlow();

	onMount(() => {
		if ($viewportStore && $viewportStore.x !== undefined) {
			setViewport($viewportStore, { duration: 0 });
		}
	});

	/** @type {any} */
	let saveTimeout;
	$effect(() => {
		const currentViewport = getViewport();

		if (currentViewport) {
			clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => {
				$viewportStore.x = currentViewport.x;
				$viewportStore.y = currentViewport.y;
				$viewportStore.zoom = currentViewport.zoom;
			}, 300);
		}
	});
</script>
