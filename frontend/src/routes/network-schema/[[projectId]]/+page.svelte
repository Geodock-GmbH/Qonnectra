<script>
	// Skeleton
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { page } from '$app/stores';
	import { PUBLIC_API_URL } from '$env/static/public';
	import Drawer from '$lib/components/Drawer.svelte';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { edgeSnappingEnabled, selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';
	import { Background, Controls, Panel, SvelteFlow } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount, setContext } from 'svelte';
	import CableDiagramEdge from './CableDiagramEdge.svelte';
	import CableDiagramNode from './CableDiagramNode.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	let userCableName = $state('');
	let selectedCableType = $state([]);
	const nodeTypes = { cableDiagramNode: CableDiagramNode };
	const edgeTypes = { cableDiagramEdge: CableDiagramEdge };

	let nodes = $state.raw(transformNodesToSvelteFlow(data.nodes));
	let edges = $state.raw(transformCablesToSvelteFlowEdges(data.cables));
	let cableTypes = $state(data.cableTypes);
	let prevUrl = $state($page.url.href);

	setContext('attributeOptions', {
		nodeTypes: data.nodeTypes,
		cableTypes: data.cableTypes,
		statuses: data.statuses,
		networkLevels: data.networkLevels,
		companies: data.companies,
		flags: data.flags
	});

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
					label: cable.labelData?.text || cable.name,
					cable: cable,
					labelData: cable.labelData
				}
			}));

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
				type: 'cableDiagramNode',
				data: {
					label: node.name || 'Unnamed Node',
					node: node
				}
			};
		});
	}

	/**
	 * Handle node drag stop
	 * @param {Object} event - Event object
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
	 * Generate random string for cable names
	 * @param {number} length - The length of the random string
	 * @returns {string} The random string
	 */
	function generateRandomString(length = 10) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const array = new Uint32Array(length);
		crypto.getRandomValues(array);
		return Array.from(array, (x) => chars[x % chars.length]).join('');
	}

	/**
	 * Parse handle ID to extract position
	 * @param {string} handleId - Handle ID format: {nodeUuid}-{position}-{type}
	 * @returns {string} 'top', 'right', 'bottom', or 'left'
	 */
	function parseHandlePosition(handleId) {
		if (!handleId) return null;
		const parts = handleId.split('-');
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

		// Generate cable name: use user input as prefix if provided, always append random string
		const trimmedName = userCableName.trim();
		const cableName =
			trimmedName.length === 0
				? generateRandomString()
				: `${trimmedName}-${generateRandomString()}`;

		if (selectedCableType.length === 0) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_no_cable_type_selected()
			});
			return;
		}

		// Generate UUID client-side for immediate use
		const cableUuid = crypto.randomUUID();

		try {
			// Create cable via form action
			// For some reason the parseHandlePosition function returns the opposite of what it should return
			// This could be because we have overlapping source + target handles for bidirectional connections
			// Changed are: uuid_node_start_id, uuid_node_end_id, handle_start, handle_end
			const formData = new FormData();
			formData.append('uuid', cableUuid);
			formData.append('name', cableName);
			formData.append('cable_type_id', selectedCableType?.[0]);
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

			// Validate that the UUID matches what we sent
			if (cableData.uuid !== cableUuid) {
				console.warn(
					`UUID mismatch: sent ${cableUuid}, received ${cableData.uuid}. Using received UUID.`
				);
			}

			edges = [
				...edges,
				{
					id: cableUuid,
					source: target,
					target: source,
					sourceHandle: handleEnd ? `${target}-${handleEnd}-source` : undefined,
					targetHandle: handleStart ? `${source}-${handleStart}-target` : undefined,
					type: 'cableDiagramEdge',
					data: {
						label: cableName,
						cable: { ...cableData, uuid: cableUuid }
					}
				}
			];

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_cable()
			});
		} catch (error) {
			console.error('Error creating cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_cable()
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
	 * Handle cable path updates from CableDiagramEdge
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
					description: m.message_success_updating_cable_path()
				});
			} catch (error) {
				console.error('Error saving cable path:', error);
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable_path()
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

	/**
	 * Handle cable handle updates - updates edge source/target handles
	 * @param {CustomEvent} event - Event with handle update details
	 */
	function handleCableHandleUpdate(event) {
		const { cableId, handleStart, handleEnd } = event.detail;

		const edge = edges.find((e) => e.id === cableId);
		if (!edge) {
			console.error(`Edge not found for cable ID: ${cableId}`);
			return;
		}

		console.log(edge);
		console.log(cableId);
		// Backend stores handles swapped: handle_start is for uuid_node_start (edge.target)
		// and handle_end is for uuid_node_end (edge.source), so we need to swap them here
		edges = edges.map((e) => {
			if (e.id === cableId) {
				return {
					...e,
					sourceHandle: handleStart ? `${edge.source}-${handleStart}-source` : undefined,
					targetHandle: handleEnd ? `${edge.target}-${handleEnd}-target` : undefined,
					data: {
						...e.data,
						cable: {
							...e.data.cable,
							handle_start: handleStart,
							handle_end: handleEnd
						}
					}
				};
			}
			return e;
		});
	}

	// // Listen for cable path update events
	$effect(() => {
		window.addEventListener('updateCablePath', handleCablePathUpdate);

		return () => {
			window.removeEventListener('updateCablePath', handleCablePathUpdate);
		};
	});

	// Listen for cable handle update events
	$effect(() => {
		window.addEventListener('updateCableHandles', handleCableHandleUpdate);

		return () => {
			window.removeEventListener('updateCableHandles', handleCableHandleUpdate);
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
				<div class="card bg-surface-50-950 p-2 rounded-lg shadow-lg">
					<h1 class="text-lg font-semibold mb-1">{m.common_attributes()}</h1>
					<div class="flex flex-col gap-2">
						<label for="cable_name_input" class="text-sm font-medium">
							<input
								class="input"
								type="text"
								placeholder={m.common_name()}
								bind:value={userCableName}
							/>
						</label>

						<GenericCombobox
							data={cableTypes}
							bind:value={selectedCableType}
							defaultValue={selectedCableType}
							placeholder={m.placeholder_select_cable_type()}
							onValueChange={(e) => {
								selectedCableType = e.value;
							}}
						/>
					</div>

					<div class="gap-2 flex items-center justify-between bg-surface-50-900 rounded-lg p-2">
						<h3 class="text-sm font-medium">{m.form_live_updates()}</h3>
						<Switch
							name="position-update-switch"
							checked={positionUpdateActive}
							onCheckedChange={() => {
								if (positionUpdateActive) {
									stopPositionUpdates();
								} else {
									positionUpdateActive = true;
									startPositionUpdates();
								}
							}}
						></Switch>
					</div>

					<div class="gap-2 flex items-center justify-between bg-surface-50-900 rounded-lg p-2">
						<h3 class="text-sm font-medium">Edge Snapping</h3>
						<Switch
							name="edge-snapping-switch"
							checked={$edgeSnappingEnabled}
							onCheckedChange={(e) => {
								$edgeSnappingEnabled = e.checked;
							}}
						></Switch>
					</div>
				</div>
			</Panel>
		</SvelteFlow>
	</div>

	<!-- Drawer -->
	<Drawer />
</div>

<style>
	/* Hide the default SvelteFlow edge path that appears during connection creation */
	:global(path[id^='xy-edge__'].svelte-flow__edge-path) {
		display: none;
	}
</style>
