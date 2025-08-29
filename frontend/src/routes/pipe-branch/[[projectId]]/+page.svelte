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
	import PipeBranchEdge from './PipeBranchEdge.svelte';

	// SvelteFlow
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	// Paraglide
	import { m } from '$lib/paraglide/messages';
	import { derived } from 'svelte/store';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	let selectedNode = $state([]);
	let branches = $derived(data?.nodes && Array.isArray(data.nodes) ? data.nodes : []);
	let apiResponse = $state(null);
	let trenches = $derived(apiResponse?.trenches || []);

	const nodeTypes = { pipeBranch: PipeBranchNode };
	const edgeTypes = { customEdge: PipeBranchEdge };
	let edges = $state.raw([
		{
			id: 'e1',
			type: 'customEdge',
			source: 'node-1',
			target: 'node-2'
		}
	]);
	let nodes = $state([]);

	$effect(() => {
		if (!trenches || trenches.length === 0) {
			nodes = [];
			return;
		}
		
		const conduitNodes = [];
		let nodeIndex = 0;
		
		trenches.forEach((trench) => {
			if (!trench.conduits || trench.conduits.length === 0) {
				return;
			}
			
			trench.conduits.forEach((conduit) => {
				const totalMicroducts = conduit.microducts ? conduit.microducts.length : 0;
				const nodeRadius = Math.max(60, 40 + totalMicroducts * 3);
				const nodeSpacing = nodeRadius * 3;
				
				conduitNodes.push({
					id: `trench-${trench.uuid}-conduit-${conduit.uuid}`,
					type: 'pipeBranch',
					position: { 
						x: nodeIndex * nodeSpacing + nodeRadius,
						y: 150 
					},
					data: {
						trench: trench,
						conduit: conduit,
						totalMicroducts: totalMicroducts,
						nodeName: apiResponse?.node_name || '',
						projectId: apiResponse?.project_id || null,
						distance: apiResponse?.distance || 0
					}
				});
				nodeIndex++;
			});
		});
		
		console.log('Created conduit nodes:', conduitNodes.length, conduitNodes);
		nodes = conduitNodes;
	});

	async function getTrenchesNearNode(nodeName, project) {
		if (!nodeName || !project) return;

		try {
			const response = await fetch(
				`/api/trench-near-nodes?node_name=${encodeURIComponent(nodeName)}&project=${project}`
			);
			if (response.ok) {
				apiResponse = await response.json();
				console.log('API Response:', apiResponse);
			} else {
				console.error('Failed to fetch trenches near node:', await response.text());
				apiResponse = null;
			}
		} catch (error) {
			console.error('Error fetching trenches near node:', error);
			apiResponse = null;
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
	<SvelteFlow bind:nodes bind:edges fitView {nodeTypes} {edgeTypes}>
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
