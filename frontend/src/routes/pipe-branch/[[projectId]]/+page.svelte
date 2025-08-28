<script>
	// Skeleton
	import { Combobox } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { navigating, page } from '$app/stores';
	import { selectedProject } from '$lib/stores/store';
	import { goto } from '$app/navigation';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import PipeBranchNode from './PipeBranchNode.svelte';

	// SvelteFlow
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	let selectedNode = $state([]);
	let branches = $derived(data?.nodes && Array.isArray(data.nodes) ? data.nodes : []);
	let trenches = $state([]);
	const nodeTypes = { pipeBranch: PipeBranchNode };
	let nodes = $state([
		{
			id: 'node-1',
			type: 'pipeBranch',
			position: { x: 0, y: 0 }
		}
	]);

	async function getTrenchesNearNode(nodeName, project) {
		if (!nodeName || !project) return;

		try {
			const response = await fetch(
				`/api/trench-near-nodes?node_name=${encodeURIComponent(nodeName)}&project=${project}`
			);
			if (response.ok) {
				trenches = await response.json();
				console.log(trenches);
			} else {
				console.error('Failed to fetch trenches near node:', await response.text());
				trenches = [];
			}
		} catch (error) {
			console.error('Error fetching trenches near node:', error);
			trenches = [];
		}
	}

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
	<SvelteFlow bind:nodes fitView {nodeTypes}>
		<Panel position="top-left">
			<GenericCombobox
				data={branches}
				bind:value={selectedNode}
				defaultValue={selectedNode}
				placeholder={m.select_pipe_branch()}
				onValueChange={(e) => {
					selectedNode = e.value;
					if (e.value && e.value.length > 0) {
						const nodeName = e.value[0]?.name || e.value[0];
						const project = $selectedProject?.[0] || $selectedProject;
						getTrenchesNearNode(nodeName, project);
					}
				}}
			/>
		</Panel>
		<Background class="z-0" bgColor="var(--color-surface-100-900)" />
		<Controls />
	</SvelteFlow>
</div>
