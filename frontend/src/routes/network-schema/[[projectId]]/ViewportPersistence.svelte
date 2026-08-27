<script lang="ts">
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';

	import { networkSchemaChildViewport, networkSchemaViewport } from '$lib/stores/store';

	let { isChildView = false }: { isChildView?: boolean } = $props();

	const viewportStore = $derived(isChildView ? networkSchemaChildViewport : networkSchemaViewport);

	const { getViewport, setViewport } = useSvelteFlow();

	onMount(() => {
		if ($viewportStore && $viewportStore.x !== undefined) {
			setViewport($viewportStore, { duration: 0 });
		}
	});

	let saveTimeout: ReturnType<typeof setTimeout>;
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
