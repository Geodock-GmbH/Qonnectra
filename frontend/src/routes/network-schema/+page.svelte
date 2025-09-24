<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// SvelteFlow
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	// Svelte
	import { drawerStore } from '$lib/stores/drawer';
	import Card from './Card.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import CableDiagramNode from './CableDiagramNode.svelte';
	import { selectedProject } from '$lib/stores/store';
	import { navigating, page } from '$app/stores';
	import { goto } from '$app/navigation';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	const nodeTypes = { cableDiagramNode: CableDiagramNode };

	const initialNodes = [
		{
			id: '1',
			type: 'cableDiagramNode',
			position: { x: 0, y: 150 },
			data: {
				label: '006_SCH554_R3(H) - Wechsel Egeplast auf Gabocom'
			}
		}
	];

	/**
	 * Transform Node data to SvelteFlow nodes using backend canvas coordinates
	 * @param {Object|Array} nodeData - GeoJSON FeatureCollection or array of Node objects from the API
	 * @returns {Array} SvelteFlow compatible nodes
	 */
	function transformNodesToSvelteFlow(nodeData) {
		const nodes = nodeData?.features || nodeData || [];
		if (!nodes || nodes.length === 0) {
			return [];
		}

		return nodes.map((nodeOrFeature) => {
			const node = nodeOrFeature.properties || nodeOrFeature;
			let x = node.canvas_x;
			let y = node.canvas_y;

			if (x === null || y === null || x === undefined || y === undefined) {
				const geometry = nodeOrFeature.geometry || node.geometry;
				const [geoX, geoY] = geometry?.coordinates || [0, 0];
				x = geoX * 0.0001;
				y = -geoY * 0.0001;
			}

			return {
				id: nodeOrFeature.id || node.uuid,
				position: { x, y },
				data: {
					label: node.name || 'Unnamed Node',
					type: 'Node',
					nodeType: node.node_type?.node_type,
					status: node.status?.status,
					networkLevel: node.network_level?.network_level,
					owner: node.owner?.company
				},
				type: 'cableDiagramNode'
			};
		});
	}

	let nodes = $state.raw(transformNodesToSvelteFlow(data.nodes));
	let edges = $state.raw([]);
</script>

<svelte:head>
	<title>{m.network_schema()}</title>
</svelte:head>

<div class="flex gap-4 h-full">
	<!-- Main Content -->
	<div class="flex-1 border-2 rounded-lg border-surface-200-800 h-full">
		<SvelteFlow
			bind:nodes
			bind:edges
			fitView
			{nodeTypes}
			connectionMode="loose"
			snapToGrid={true}
			snapGrid={[120, 120]}
		>
			<Background class="z-0" bgColor="var(--color-surface-100-900) " />
			<Controls />
			<Panel position="top-left">
				<div class="bg-surface-100-900 p-2 rounded-lg shadow-lg">
					<h3 class="text-sm font-semibold mb-1">Node Test</h3>
					<p class="text-xs text-surface-700-300">
						Project: 1 | Total: {nodes.length} nodes
					</p>
					{#if data.nodes?.length > 0}
						<p class="text-xs text-success-700-300 mt-1">✓ Using backend canvas coordinates</p>
					{:else}
						<p class="text-xs text-warning-700-300 mt-1">⚠ No nodes loaded</p>
					{/if}
					<button
						class="btn variant-filled-primary btn-sm mt-2 w-full text-xs"
						onclick={() => drawerStore.open({ title: 'Test Drawer' })}
					>
						Test Drawer
					</button>
				</div>
			</Panel>
		</SvelteFlow>
	</div>

	<!-- Drawer -->
	<Drawer>
		<Card />
	</Drawer>
</div>
