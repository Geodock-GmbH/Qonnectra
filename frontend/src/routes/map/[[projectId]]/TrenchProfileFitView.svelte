<script>
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';

	const { fitView } = useSvelteFlow();

	onMount(() => {
		setTimeout(() => fitView({ padding: 0.3 }), 300);
	});
</script>
