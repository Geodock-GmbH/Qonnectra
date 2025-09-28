<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';
	import Drawer from '$lib/components/Drawer.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';
	import { onMount } from 'svelte';
	import CableDiagramNode from './CableDiagramNode.svelte';
	import Card from './Card.svelte';
	// SvelteFlow
	import { Background, Controls, Panel, SvelteFlow } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	const nodeTypes = { cableDiagramNode: CableDiagramNode };

	let nodes = $state.raw(transformNodesToSvelteFlow(data.nodes));
	let edges = $state.raw([]);

	let positionUpdateActive = $state(true);
	let positionUpdateController = null;

	onMount(async () => {
		await autoLockSvelteFlow();
		if (data.syncStatus) {
			if (data.syncStatus.sync_status === 'FAILED') {
				globalToaster.error({
					title: m.title_error_canvas_sync_failed(),
					description: data.syncStatus.error_message || m.message_error_canvas_sync_failed()
				});
			} else if (data.syncStatus.sync_status === 'COMPLETED') {
				globalToaster.success({
					title: m.title_success_canvas_sync_complete()
				});
			}
		}
	});

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

	/**
	 * Handle node drag stop
	 */
	async function handleNodeDragStop(event) {
		const node = event.targetNode;
		const nodeId = node.id;
		const newPosition = node.position;

		const originalNode = nodes.find((n) => n.id === nodeId);
		const originalPosition = { ...originalNode.position };

		try {
			const formData = new FormData();
			formData.append('nodeId', nodeId);
			formData.append('canvas_x', newPosition.x.toString());
			formData.append('canvas_y', newPosition.y.toString());

			const response = await fetch('?/saveNodeGeometry', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok || result.type === 'error') {
				throw new Error(result.message || 'Failed to save node position');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_position()
			});
		} catch (error) {
			console.error('Error saving node position:', error);

			const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
			if (nodeIndex !== -1) {
				nodes[nodeIndex] = {
					...nodes[nodeIndex],
					position: originalPosition
				};
			}

			globalToaster.error({
				title: m.common_error(),
				description: `${error.message}`
			});
		}
	}

	/**
	 * Long-polling endpoint for real-time node position updates
	 */
	async function startPositionUpdates() {
		if (!positionUpdateActive) return;

		positionUpdateController = new AbortController();

		try {
			while (positionUpdateActive && !positionUpdateController.signal.aborted) {
				const response = await fetch(
					`${PUBLIC_API_URL}node-position-listen/?project=1&timeout=30`,
					{
						signal: positionUpdateController.signal,
						credentials: 'include'
					}
				);

				if (!response.ok) {
					console.warn('Position update request failed:', response.status);
					await new Promise((resolve) => setTimeout(resolve, 5000));
					continue;
				}

				const data = await response.json();

				if (data.updates && data.updates.length > 0) {
					for (const update of data.updates) {
						nodes = nodes.map((n) => {
							return n.id === update.node_id
								? {
										...n,
										position: {
											x: update.canvas_x,
											y: update.canvas_y
										}
									}
								: n;
						});
					}
				}
			}
		} catch (error) {
			if (error.name !== 'AbortError') {
				console.error('Position update error:', error);
				if (positionUpdateActive) {
					setTimeout(startPositionUpdates, 5000);
				}
			}
		}
	}

	/**
	 * Stop position updates
	 */
	function stopPositionUpdates() {
		positionUpdateActive = false;
		if (positionUpdateController) {
			positionUpdateController.abort();
			positionUpdateController = null;
		}
	}

	// Start position updates when component mounts
	$effect(() => {
		if (positionUpdateActive) {
			startPositionUpdates();
		}

		// Cleanup when component unmounts
		return () => {
			stopPositionUpdates();
		};
	});
</script>

<svelte:head>
	<title>{m.nav_network_schema()}</title>
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
			onnodedragstop={handleNodeDragStop}
		>
			<Background class="z-0" bgColor="var(--color-surface-100-900) " />
			<Controls />
			<Panel position="top-left">
				<div class="bg-surface-100-900 p-2 rounded-lg shadow-lg">
					<h3 class="text-sm font-semibold mb-1">Network Schema</h3>
					<p class="text-xs text-surface-700-300">
						Project: 1 | Total: {nodes.length} nodes
					</p>

					{#if data.syncStatus?.sync_in_progress}
						<div class="mt-1">
							<p class="text-xs text-warning-700-300">🔄 Canvas sync in progress</p>
							<p class="text-xs text-surface-600-400">
								{data.syncStatus.sync_progress.toFixed(1)}% complete
							</p>
							{#if data.syncStatus.sync_started_by}
								<p class="text-xs text-surface-600-400">
									Started by: {data.syncStatus.sync_started_by}
								</p>
							{/if}
						</div>
					{:else if data.syncStatus?.sync_status === 'FAILED'}
						<p class="text-xs text-error-700-300 mt-1">❌ Canvas sync failed</p>
						{#if data.syncStatus.error_message}
							<p class="text-xs text-surface-600-400">
								{data.syncStatus.error_message}
							</p>
						{/if}
					{:else if data.nodes?.length > 0}
						<p class="text-xs text-success-700-300 mt-1">✓ Canvas coordinates ready</p>
					{:else}
						<p class="text-xs text-warning-700-300 mt-1">⚠ No nodes loaded</p>
					{/if}

					<button
						class="btn variant-filled-primary btn-sm mt-2 w-full text-xs"
						onclick={() => drawerStore.open({ title: 'Node Details' })}
					>
						Node Details
					</button>

					<button
						class="btn {positionUpdateActive
							? 'variant-filled-success'
							: 'variant-filled-surface'} btn-sm mt-1 w-full text-xs"
						onclick={() => {
							if (positionUpdateActive) {
								stopPositionUpdates();
							} else {
								positionUpdateActive = true;
								startPositionUpdates();
							}
						}}
					>
						{positionUpdateActive ? 'Live Updates ON' : 'Live Updates OFF'}
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
