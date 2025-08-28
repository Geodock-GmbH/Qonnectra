<script>
	// Skeleton
	import { Combobox } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { navigating, page } from '$app/stores';
	import { selectedProject } from '$lib/stores/store';
	import { goto } from '$app/navigation';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';

	// SvelteFlow
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	let selectedNode = $state([]);
	let nodes = $derived(data?.nodes && Array.isArray(data.nodes) ? data.nodes : []);

	$effect(() => {
		const projectId = $selectedProject;
		const currentPath = $page.url.pathname;

		if (projectId) {
			const targetPath = `/pipe-branch/${projectId}`;
			if (currentPath !== targetPath) {
				goto(targetPath, { keepFocus: true, noScroll: true, replaceState: true });
			}
		}
	});
</script>

<svelte:head>
	<title>{m.pipe_branch()}</title>
</svelte:head>

<div class="border-2 rounded-lg border-surface-200-800 h-full w-full">
	<SvelteFlow>
		<Panel position="top-left">
			<GenericCombobox
				data={nodes}
				bind:value={selectedNode}
				defaultValue={selectedNode}
				placeholder={m.select_pipe_branch()}
				onValueChange={(e) => {
					selectedNode = e.value;
				}}
			/>
		</Panel>
		<Background class="z-0" bgColor="var(--color-surface-100-900)" />
		<Controls />
	</SvelteFlow>
</div>
