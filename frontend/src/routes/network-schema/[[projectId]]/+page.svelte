<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { page } from '$app/stores';
	import { PUBLIC_API_URL } from '$env/static/public';
	import Drawer from '$lib/components/Drawer.svelte';
	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';
	import { Background, Controls, Panel, SvelteFlow } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';
	import CableDiagramNode from './CableDiagramNode.svelte';
	import CableDiagrammEdge from './CableDiagrammEdge.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	const nodeTypes = { cableDiagramNode: CableDiagramNode };
	const edgeTypes = { cableDiagramEdge: CableDiagrammEdge };

	let nodes = $state.raw(transformNodesToSvelteFlow(data.nodes));
	let edges = $state.raw(transformCablesToSvelteFlowEdges(data.cables));
	let prevUrl = $state($page.url.href);

	let positionUpdateActive = $state(true);
	let positionUpdateController = null;

	/**
	 * Transform Cable data to SvelteFlow edges
	 * @param {Array} cablesData - Array of Cable objects from the API
	 * @returns {Array} SvelteFlow compatible edges
	 */
	function transformCablesToSvelteFlowEdges(cablesData) {
		const cables = Array.isArray(cablesData) ? cablesData : [];

		if (cables.length === 0) {
			console.log('No cables found for this project');
			return [];
		}

		const edges = cables
			.filter((cable) => cable.uuid_node_start && cable.uuid_node_end)
			.map((cable) => ({
				id: cable.uuid,
				source: cable.uuid_node_start,
				target: cable.uuid_node_end,
				sourceHandle: cable.handle_start
					? `${cable.uuid_node_start}-${cable.handle_start}-source`
					: undefined,
				targetHandle: cable.handle_end
					? `${cable.uuid_node_end}-${cable.handle_end}-target`
					: undefined,
				type: 'cableDiagramEdge',
				data: {
					label: cable.name,
					cable: cable
				}
			}));

		console.log(`Loaded ${edges.length} cable edges`);
		return edges;
	}

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

	// TODO: Hack to reload the page when the URL changes.
	$effect(() => {
		if ($page.url.href !== prevUrl) {
			prevUrl = $page.url.href;
			window.location.reload();
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

	// TODO: Delete later
	/**
	 * Generate random string for cable names
	 *
	 */
	function generateRandomString(length = 8) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Parse handle ID to extract position
	 * Handle ID format: {nodeUuid}-{position}-{type}
	 * Returns: 'top', 'right', 'bottom', or 'left'
	 */
	function parseHandlePosition(handleId) {
		if (!handleId) return null;
		const parts = handleId.split('-');
		// Position is the second-to-last part (before 'source' or 'target')
		return parts[parts.length - 2];
	}

	/**
	 * Handle new edge connection
	 * Creates a Cable record in the database using form action
	 */
	async function handleConnect(connection) {
		const { source, target, sourceHandle, targetHandle } = connection;

		// Extract handle positions
		const handleStart = parseHandlePosition(sourceHandle);
		const handleEnd = parseHandlePosition(targetHandle);

		// Generate random cable name
		const cableName = `CABLE_${generateRandomString()}`;

		try {
			// Create cable via form action
			// For some reason the parseHandlePosition function returns the opposite of what it should return
			// This could be because we have overlapping source + target handles for bidirectional connections
			// Changed are: uuid_node_start_id, uuid_node_end_id, handle_start, handle_end
			const formData = new FormData();
			formData.append('name', cableName);
			formData.append('cable_type_id', '1');
			formData.append('project_id', $selectedProject);
			formData.append('flag_id', '1');
			formData.append('uuid_node_start_id', target);
			formData.append('uuid_node_end_id', source);
			if (handleStart) formData.append('handle_start', handleEnd);
			if (handleEnd) formData.append('handle_end', handleStart);

			const response = await fetch('?/createCable', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok || result.type === 'error') {
				throw new Error(result.error || 'Failed to create cable');
			}

			const cableData = result.data;

			// Add edge to the flow
			edges = [
				...edges,
				{
					id: cableData.uuid,
					source,
					target,
					sourceHandle,
					targetHandle,
					type: 'cableDiagramEdge',
					data: {
						label: cableName,
						cable: cableData
					}
				}
			];

			globalToaster.success({
				title: m.title_success(),
				description: `Cable ${cableName} created successfully`
			});
		} catch (error) {
			console.error('Error creating cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: `Failed to create cable: ${error.message}`
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
					`${PUBLIC_API_URL}node-position-listen/?project=${$selectedProject}&timeout=30`,
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

	/**
	 * Handle cable path updates from CableDiagrammEdge
	 */
	async function handleCablePathUpdate(event) {
		const { edgeId, waypoints, temporary, save } = event.detail;

		// Find and update the edge in the local state
		edges = edges.map((edge) => {
			if (edge.id === edgeId) {
				return {
					...edge,
					data: {
						...edge.data,
						cable: {
							...edge.data.cable,
							diagram_path: waypoints
						}
					}
				};
			}
			return edge;
		});

		// Save to backend if not temporary
		if (save) {
			try {
				const formData = new FormData();
				formData.append('cableId', edgeId);
				formData.append('diagram_path', JSON.stringify(waypoints));

				const response = await fetch('?/saveCableGeometry', {
					method: 'POST',
					body: formData
				});

				const result = await response.json();

				if (!response.ok || result.type === 'error') {
					throw new Error(result.message || 'Failed to save cable path');
				}

				globalToaster.success({
					title: m.title_success(),
					description: 'Cable path updated successfully'
				});
			} catch (error) {
				console.error('Error saving cable path:', error);
				globalToaster.error({
					title: m.common_error(),
					description: `Failed to save cable path: ${error.message}`
				});
			}
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

	// // Listen for cable path update events
	$effect(() => {
		window.addEventListener('updateCablePath', handleCablePathUpdate);

		return () => {
			window.removeEventListener('updateCablePath', handleCablePathUpdate);
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
			{edgeTypes}
			connectionMode="loose"
			snapToGrid={true}
			snapGrid={[120, 120]}
			onnodedragstop={handleNodeDragStop}
			onconnect={handleConnect}
			connectionRadius={100}
			noPanClass="nopan"
		>
			<Background class="z-0" bgColor="var(--color-surface-100-900) " />
			<Controls />
			<Panel position="top-left">
				<div class="bg-surface-500 p-2 rounded-lg shadow-lg">
					<h3 class="text-sm font-semibold mb-1">Network Schema</h3>
					<p class="text-xs">
						Project: {$selectedProject} | Total: {nodes.length} nodes
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
	<Drawer></Drawer>
</div>
