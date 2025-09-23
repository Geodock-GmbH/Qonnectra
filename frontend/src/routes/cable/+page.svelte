<script>
	// SvelteFlow
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	/**
	 * Transform GeoJSON features to SvelteFlow nodes
	 * @param {Object|Array} nodeData - GeoJSON FeatureCollection or array of features from the API
	 * @returns {Array} SvelteFlow compatible nodes
	 */
	function transformFeaturesToSvelteFlow(nodeData) {
		// Handle both FeatureCollection and direct array of features
		const features = nodeData?.features || nodeData || [];
		if (!features || features.length === 0) {
			return [];
		}

		// Extract coordinates from all features
		const coordinates = features.map((feature) => {
			const [x, y] = feature.geometry.coordinates;
			return { x, y };
		});

		// Calculate bounding box
		const minX = Math.min(...coordinates.map((c) => c.x));
		const maxX = Math.max(...coordinates.map((c) => c.x));
		const minY = Math.min(...coordinates.map((c) => c.y));
		const maxY = Math.max(...coordinates.map((c) => c.y));

		// Calculate center and scale
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		// Use a fixed scale to preserve geographic relationships
		const scale = 0.2; // Adjust this value as needed

		return features.map((feature) => {
			const [geoX, geoY] = feature.geometry.coordinates;

			// Transform to SvelteFlow coordinates
			const x = (geoX - centerX) * scale;
			// Flip Y axis: geographic Y increases north, SvelteFlow Y increases south
			const y = -(geoY - centerY) * scale;

			return {
				id: feature.id || feature.properties.uuid,
				position: { x, y },
				data: {
					label: feature.properties.name || 'Unnamed Node',
					type: 'Node',
					nodeType: feature.properties.node_type?.node_type,
					status: feature.properties.status?.status,
					networkLevel: feature.properties.network_level?.network_level,
					owner: feature.properties.owner?.company
				},
				type: 'default'
			};
		});
	}

	// Transform the loaded features (nodes only)
	let svelteFlowNodes = $state.raw(transformFeaturesToSvelteFlow(data.nodes));
	let edges = $state.raw([]);
</script>

<div class="border-2 rounded-lg border-surface-200-800 h-full w-full">
	<SvelteFlow bind:nodes={svelteFlowNodes} bind:edges fitView>
		<Background class="z-0" bgColor="var(--color-surface-100-900)" />
		<Controls />
		<Panel position="top-left">
			<div class="bg-surface-100-900 p-2 rounded-lg shadow-lg">
				<h3 class="text-sm font-semibold mb-1">Node Test</h3>
				<p class="text-xs text-surface-700-300">
					Project: 1 | Total: {svelteFlowNodes.length} nodes
				</p>
				{#if data.nodes?.features?.length > 0 || data.nodes?.length > 0}
					<p class="text-xs text-success-700-300 mt-1">✓ Coordinates transformed from EPSG:3857</p>
				{:else}
					<p class="text-xs text-warning-700-300 mt-1">⚠ No nodes loaded</p>
				{/if}
			</div>
		</Panel>
	</SvelteFlow>
</div>
