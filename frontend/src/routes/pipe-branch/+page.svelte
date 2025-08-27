<script>
	import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import { m } from '$lib/paraglide/messages';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
</script>

<svelte:head>
	<title>{m.pipe_branch()}</title>
</svelte:head>

<div class="border-2 rounded-lg border-surface-200-800 h-full w-full">
	<SvelteFlow>
		<Background bgColor="var(--color-surface-200-800)" />
		<Controls />
	</SvelteFlow>
</div>
