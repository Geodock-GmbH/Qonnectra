<script>
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';

	import { networkSchemaViewport } from '$lib/stores/store';

	const { getViewport, setViewport } = useSvelteFlow();

	onMount(() => {
		if ($networkSchemaViewport && $networkSchemaViewport.x !== undefined) {
			setViewport($networkSchemaViewport, { duration: 0 });
		}
	});

	let saveTimeout;
	$effect(() => {
		const currentViewport = getViewport();

		if (currentViewport) {
			clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => {
				$networkSchemaViewport.x = currentViewport.x;
				$networkSchemaViewport.y = currentViewport.y;
				$networkSchemaViewport.zoom = currentViewport.zoom;
			}, 300);
		}
	});
</script>
