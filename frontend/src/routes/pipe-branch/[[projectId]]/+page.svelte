<script>
	// Skeleton
	import { createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';
	// Svelte
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { selectedProject } from '$lib/stores/store';
	import { onMount } from 'svelte';
	import LassoModeSwitch from './LassoModeSwitch.svelte';
	import PipeBranchEdge from './PipeBranchEdge.svelte';
	import PipeBranchLasso from './PipeBranchLasso.svelte';
	import PipeBranchNode from './PipeBranchNode.svelte';
	// SvelteFlow
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';
	import { Background, Controls, Panel, SvelteFlow } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	let selectedNode = $state([]);
	let branches = $derived(data?.nodes && Array.isArray(data.nodes) ? data.nodes : []);
	let apiResponse = $state(null);
	let trenches = $derived(apiResponse?.trenches || []);

	// Lasso mode state
	let isLassoMode = $state(false);
	let partialSelection = $state(false);
	let selectedNodeIds = $state([]);
	let lassoComponent = $state(null);

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	onMount(async () => {
		await autoLockSvelteFlow();
	});

	const nodeTypes = { pipeBranch: PipeBranchNode };
	const edgeTypes = { pipeBranchEdge: PipeBranchEdge };
	let edges = $state.raw([]);
	let nodes = $state.raw([]);

	// Helper function to parse handle ID and extract microduct data
	function parseHandleId(handleId) {
		// Remove -source or -target suffix first
		const baseHandleId = handleId.replace(/-(source|target)$/, '');
		const match = baseHandleId.match(/conduit-(.+?)-microduct-(\d+)/);
		if (!match) return null;
		return {
			conduitUuid: match[1],
			microductNumber: parseInt(match[2])
		};
	}

	// Get microduct UUID from handle ID and nodes
	function getMicroductUuid(nodeId, handleId) {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node?.data?.conduit?.microducts) return null;

		const handleData = parseHandleId(handleId);
		if (!handleData) return null;

		const microduct = node.data.conduit.microducts.find(
			(m) => m.number === handleData.microductNumber
		);
		return microduct?.uuid || null;
	}

	// Get handle data for edge display
	function getHandleData(nodeId, handleId) {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node?.data?.conduit?.microducts) return {};

		const handleData = parseHandleId(handleId);
		if (!handleData) return {};

		const microduct = node.data.conduit.microducts.find(
			(m) => m.number === handleData.microductNumber
		);

		return {
			microductUuid: microduct?.uuid,
			microductNumber: handleData.microductNumber,
			conduitName: node.data.conduit.name,
			conduitUuid: node.data.conduit.uuid
		};
	}

	// Helper function to parse dehydrated response format
	function parseDehydratedResponse(response) {
		if (!Array.isArray(response)) return response;

		// Function to resolve a value by following indices
		function resolveValue(index) {
			if (typeof index !== 'number') return index;
			const value = response[index];

			// If it's an object with numeric keys, resolve each property
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				const resolved = {};
				for (const [key, valueIndex] of Object.entries(value)) {
					resolved[key] = resolveValue(valueIndex);
				}
				return resolved;
			}

			// If it's an array, resolve each element
			if (Array.isArray(value)) {
				return value.map(resolveValue);
			}

			return value;
		}

		// The response structure seems to start with metadata at index 0
		const metadata = response[0];
		if (metadata?.type === 1 && metadata?.data) {
			return resolveValue(metadata.data);
		}

		return response;
	}

	$effect(() => {
		if (!trenches || trenches.length === 0) {
			nodes = [];
			return;
		}

		const conduitNodes = [];
		let nodeIndex = 0;

		let totalNodes = 0;
		trenches.forEach((trench) => {
			if (trench.conduits && trench.conduits.length > 0) {
				totalNodes += trench.conduits.length;
			}
		});

		const centerX = 400;
		const centerY = 300;
		const circleRadius = Math.max(800, totalNodes * 50);

		trenches.forEach((trench) => {
			if (!trench.conduits || trench.conduits.length === 0) {
				return;
			}

			trench.conduits.forEach((conduit) => {
				const totalMicroducts = conduit.microducts ? conduit.microducts.length : 0;

				// Calculate angle for this node (evenly distributed around the circle)
				const angle = (nodeIndex * 2 * Math.PI) / totalNodes;

				// Calculate position using trigonometry
				const x = centerX + circleRadius * Math.cos(angle);
				const y = centerY + circleRadius * Math.sin(angle);

				conduitNodes.push({
					id: `trench-${trench.uuid}-conduit-${conduit.uuid}`,
					type: 'pipeBranch',
					position: {
						x: x,
						y: y
					},
					selected: false, // Initialize with selected state
					zIndex: 1, // Lower z-index for nodes
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

		nodes = conduitNodes;
	});

	async function getTrenchesNearNode(nodeName, project) {
		if (!nodeName || !project) return;

		try {
			const formData = new FormData();
			formData.append('node_name', nodeName);
			formData.append('project', project);

			const response = await fetch('?/getTrenchesNearNode', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				let rawResponse = await response.json();
				let parsedData = JSON.parse(rawResponse.data);

				// Handle dehydrated response format
				if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
					parsedData = parseDehydratedResponse(parsedData);
				}

				apiResponse = parsedData;
				await loadExistingConnections();
			} else {
				console.error('Failed to fetch trenches near node:', await response.text());
				apiResponse = null;
			}
		} catch (error) {
			console.error('Error fetching trenches near node:', error);
			apiResponse = null;
		}
	}

	// Load existing connections from the backend
	async function loadExistingConnections() {
		if (!apiResponse?.node_uuid) return;

		try {
			const formData = new FormData();
			formData.append('node_id', apiResponse.node_uuid);
			const response = await fetch('?/getConnections', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				let rawResponse = await response.json();
				let parsedData = JSON.parse(rawResponse.data);
				if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
					parsedData = parseDehydratedResponse(parsedData);
				}

				const connections = parsedData;
				// Convert connections to edges
				const connectionEdges =
					connections
						?.map((conn) => {
							// Find nodes and handle IDs for this connection using both trench and microduct UUIDs
							const sourceNode = nodes.find(
								(n) =>
									n.data?.trench?.uuid === conn.uuid_trench_from.id &&
									n.data?.conduit?.microducts?.some((m) => m.uuid === conn.uuid_microduct_from.uuid)
							);
							const targetNode = nodes.find(
								(n) =>
									n.data?.trench?.uuid === conn.uuid_trench_to.id &&
									n.data?.conduit?.microducts?.some((m) => m.uuid === conn.uuid_microduct_to.uuid)
							);

							if (!sourceNode || !targetNode) return null;

							const sourceMicroduct = sourceNode.data.conduit.microducts.find(
								(m) => m.uuid === conn.uuid_microduct_from.uuid
							);
							const targetMicroduct = targetNode.data.conduit.microducts.find(
								(m) => m.uuid === conn.uuid_microduct_to.uuid
							);

							const sourceHandleId = `conduit-${sourceNode.data.conduit.uuid}-microduct-${sourceMicroduct.number}-source`;
							const targetHandleId = `conduit-${targetNode.data.conduit.uuid}-microduct-${targetMicroduct.number}-target`;

							return {
								id: `connection-${conn.uuid}`,
								type: 'pipeBranchEdge',
								source: sourceNode.id,
								target: targetNode.id,
								sourceHandle: sourceHandleId,
								targetHandle: targetHandleId,
								zIndex: 10, // Higher z-index for edges
								data: {
									uuid: conn.uuid,
									sourceHandleData: {
										microductUuid: sourceMicroduct.uuid,
										microductNumber: sourceMicroduct.number,
										conduitName: sourceNode.data.conduit.name,
										conduitUuid: sourceNode.data.conduit.uuid
									},
									targetHandleData: {
										microductUuid: targetMicroduct.uuid,
										microductNumber: targetMicroduct.number,
										conduitName: targetNode.data.conduit.name,
										conduitUuid: targetNode.data.conduit.uuid
									}
								}
							};
						})
						.filter(Boolean) || [];

				edges = connectionEdges;
			} else {
				console.error('Failed to load existing connections:', await response.text());
			}
		} catch (error) {
			console.error('Error loading existing connections:', error);
		}
	}

	// Handle connection validation before connection is made
	function handleBeforeConnect(connection) {
		// Get handle data for validation
		const sourceHandleData = getHandleData(connection.source, connection.sourceHandle);
		const targetHandleData = getHandleData(connection.target, connection.targetHandle);

		// Prevent connection if the source handle has -source suffix
		if (connection.sourceHandle && connection.sourceHandle.endsWith('-target')) {
			toaster.error({
				title: m.common_error(),
				description: m.message_error_cannot_connect_from_source()
			});
			return false; // Prevent connection
		}

		// Prevent connecting a microduct to itself
		if (sourceHandleData.microductUuid === targetHandleData.microductUuid) {
			toaster.error({
				title: m.common_error(),
				description: m.message_error_cannot_connect_microduct_to_itself()
			});
			return false; // Prevent connection
		}

		return connection;
	}

	// Watch for new edges and populate their data
	$effect(() => {
		if (!edges || !nodes) return;

		edges.forEach((edge, index) => {
			// Check if this is a new edge without data
			if (edge.id.startsWith('xy-edge__') && (!edge.data || Object.keys(edge.data).length === 0)) {
				// Extract connection info from the edge
				const sourceHandleData = getHandleData(edge.source, edge.sourceHandle);
				const targetHandleData = getHandleData(edge.target, edge.targetHandle);

				if (sourceHandleData.microductUuid && targetHandleData.microductUuid) {
					// Update the edge with data
					const updatedEdges = [...edges];
					updatedEdges[index] = {
						...edge,
						zIndex: 10, // Higher z-index for edges
						data: {
							uuid: null, // Will be set after backend persistence
							sourceHandleData,
							targetHandleData
						}
					};
					edges = updatedEdges;

					// Handle backend persistence
					const sourceMicroductUuid = getMicroductUuid(edge.source, edge.sourceHandle);
					const targetMicroductUuid = getMicroductUuid(edge.target, edge.targetHandle);
					const nodeUuid = apiResponse?.node_uuid;

					if (sourceMicroductUuid && targetMicroductUuid && nodeUuid) {
						// Get trench UUIDs from the nodes
						const sourceNode = nodes.find((n) => n.id === edge.source);
						const targetNode = nodes.find((n) => n.id === edge.target);
						const sourceTrenchUuid = sourceNode?.data?.trench?.uuid;
						const targetTrenchUuid = targetNode?.data?.trench?.uuid;

						saveConnection(
							edge,
							sourceMicroductUuid,
							targetMicroductUuid,
							nodeUuid,
							sourceTrenchUuid,
							targetTrenchUuid
						);
					}
				}
			}
		});
	});

	// Separate function for backend persistence
	async function saveConnection(
		edge,
		sourceMicroductUuid,
		targetMicroductUuid,
		nodeUuid,
		sourceTrenchUuid,
		targetTrenchUuid
	) {
		try {
			// Ensure we have single values, not arrays
			const fromUuid = Array.isArray(sourceMicroductUuid)
				? sourceMicroductUuid[0]
				: sourceMicroductUuid;
			const toUuid = Array.isArray(targetMicroductUuid)
				? targetMicroductUuid[0]
				: targetMicroductUuid;
			const nodeUuidValue = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;
			const sourceTrenchUuidValue = Array.isArray(sourceTrenchUuid)
				? sourceTrenchUuid[0]
				: sourceTrenchUuid;
			const targetTrenchUuidValue = Array.isArray(targetTrenchUuid)
				? targetTrenchUuid[0]
				: targetTrenchUuid;

			const formData = new FormData();
			formData.append('uuid_microduct_from', fromUuid);
			formData.append('uuid_microduct_to', toUuid);
			formData.append('uuid_node', nodeUuidValue);
			formData.append('uuid_trench_from', sourceTrenchUuidValue);
			formData.append('uuid_trench_to', targetTrenchUuidValue);

			const response = await fetch('?/createConnection', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				let rawResponse = await response.json();
				let parsedData = JSON.parse(rawResponse.data);
				if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
					parsedData = parseDehydratedResponse(parsedData);
				}

				const newConnection = parsedData;

				// Update the edge with the backend UUID
				const edgeIndex = edges.findIndex((e) => e.id === edge.id);
				if (edgeIndex !== -1) {
					const updatedEdges = [...edges];
					updatedEdges[edgeIndex] = {
						...updatedEdges[edgeIndex],
						id: `connection-${newConnection.uuid}`,
						data: {
							...updatedEdges[edgeIndex].data,
							uuid: newConnection.uuid
						}
					};
					edges = updatedEdges;
				}
			} else {
				const error = await response.json();
				console.error('Failed to create connection:', error);
				alert(`Failed to create connection: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error creating connection:', error);
			alert('Error creating connection');
		}
	}

	// Handle lasso selection change
	function handleLassoSelectionChange(selectedIds) {
		selectedNodeIds = selectedIds;
	}

	// Handle lasso mode change
	function handleLassoModeChange(event) {
		isLassoMode = event.checked;
		if (!isLassoMode) {
			// Clear selection when exiting lasso mode
			selectedNodeIds = [];
			if (lassoComponent?.clearSelection) {
				lassoComponent.clearSelection();
			}
		}
	}

	// Handle partial selection change
	function handlePartialSelectionChange(partial) {
		partialSelection = partial;
	}

	// Clear lasso selection
	function clearLassoSelection() {
		selectedNodeIds = [];
		if (lassoComponent?.clearSelection) {
			lassoComponent.clearSelection();
		}
	}

	// Check if edge already exists between two microducts
	function edgeExists(sourceMicroductUuid, targetMicroductUuid) {
		return edges.some((edge) => {
			const sourceData = edge.data?.sourceHandleData;
			const targetData = edge.data?.targetHandleData;
			return (
				(sourceData?.microductUuid === sourceMicroductUuid &&
					targetData?.microductUuid === targetMicroductUuid) ||
				(sourceData?.microductUuid === targetMicroductUuid &&
					targetData?.microductUuid === sourceMicroductUuid)
			);
		});
	}

	// Auto-connect two selected nodes
	async function autoConnectTwoNodes() {
		if (selectedNodeIds.length !== 2) {
			toaster.error({
				title: m.common_error(),
				description: m.message_please_select_exactly_2_nodes()
			});
			return;
		}

		const sourceNodeId = selectedNodeIds[0];
		const targetNodeId = selectedNodeIds[1];

		const sourceNode = nodes.find((n) => n.id === sourceNodeId);
		const targetNode = nodes.find((n) => n.id === targetNodeId);

		if (!sourceNode || !targetNode) {
			toaster.error({
				title: m.common_error(),
				description: 'Could not find selected nodes'
			});
			return;
		}

		const sourceMicroducts = sourceNode.data?.conduit?.microducts || [];
		const targetMicroducts = targetNode.data?.conduit?.microducts || [];

		// Find matching microducts by number
		const connections = [];
		for (const sourceMd of sourceMicroducts) {
			const targetMd = targetMicroducts.find((t) => t.number === sourceMd.number);
			if (targetMd) {
				// Check if connection already exists
				if (!edgeExists(sourceMd.uuid, targetMd.uuid)) {
					connections.push({
						source: sourceNode.id,
						target: targetNode.id,
						sourceHandle: `conduit-${sourceNode.data.conduit.uuid}-microduct-${sourceMd.number}-source`,
						targetHandle: `conduit-${targetNode.data.conduit.uuid}-microduct-${targetMd.number}-target`,
						sourceMicroduct: sourceMd,
						targetMicroduct: targetMd
					});
				}
			}
		}

		if (connections.length === 0) {
			toaster.error({
				title: m.common_error(),
				description: 'No matching microducts available for connection'
			});
			return;
		}

		// Create edges for all connections
		try {
			let successCount = 0;
			for (const conn of connections) {
				// Create temporary edge ID
				const tempEdgeId = `temp-edge-${Date.now()}-${Math.random()}`;

				// Add edge to UI
				const newEdge = {
					id: tempEdgeId,
					type: 'pipeBranchEdge',
					source: conn.source,
					target: conn.target,
					sourceHandle: conn.sourceHandle,
					targetHandle: conn.targetHandle,
					zIndex: 10,
					data: {
						uuid: null,
						sourceHandleData: {
							microductUuid: conn.sourceMicroduct.uuid,
							microductNumber: conn.sourceMicroduct.number,
							conduitName: sourceNode.data.conduit.name,
							conduitUuid: sourceNode.data.conduit.uuid
						},
						targetHandleData: {
							microductUuid: conn.targetMicroduct.uuid,
							microductNumber: conn.targetMicroduct.number,
							conduitName: targetNode.data.conduit.name,
							conduitUuid: targetNode.data.conduit.uuid
						}
					}
				};

				edges = [...edges, newEdge];

				const formData = new FormData();
				formData.append('uuid_microduct_from', conn.sourceMicroduct.uuid);
				formData.append('uuid_microduct_to', conn.targetMicroduct.uuid);
				formData.append('uuid_node', apiResponse?.node_uuid);
				formData.append('uuid_trench_from', sourceNode.data.trench.uuid);
				formData.append('uuid_trench_to', targetNode.data.trench.uuid);

				// Save to backend
				const response = await fetch('?/createConnection', {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					let rawResponse = await response.json();
					let parsedData = JSON.parse(rawResponse.data);
					if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
						parsedData = parseDehydratedResponse(parsedData);
					}

					const newConnection = parsedData;
					// Update edge with backend UUID
					edges = edges.map((edge) =>
						edge.id === tempEdgeId
							? {
									...edge,
									id: `connection-${newConnection.uuid}`,
									data: { ...edge.data, uuid: newConnection.uuid }
								}
							: edge
					);
					successCount++;
				} else {
					// Remove failed edge from UI
					edges = edges.filter((edge) => edge.id !== tempEdgeId);
					console.error('Failed to create connection:', await response.text());
				}
			}

			// Show result
			if (successCount > 0) {
				toaster.success({
					title: m.title_success(),
					description: `${successCount}x ${m.message_created_connections()}`
				});
			}

			if (successCount < connections.length) {
				toaster.error({
					title: m.common_error(),
					description: `${connections.length - successCount}x ${m.message_failed_to_create_connections()}`
				});
			}
		} catch (error) {
			console.error('Error creating connections:', error);
			toaster.error({
				title: m.common_error(),
				description: m.message_failed_to_create_connections()
			});
		}
	}

	$effect(() => {
		const projectId = $selectedProject;
		const currentPath = $page.url.pathname;

		if (projectId) {
			const targetPath = `/pipe-branch/${projectId}`;
			if (currentPath !== targetPath) {
				goto(targetPath, { keepFocus: true, noScroll: true, replaceState: true });
				nodes = [];
				edges = [];
				selectedNode = [];
			}
		}
	});
</script>

<svelte:head>
	<title>{m.nav_pipe_branch()}</title>
</svelte:head>

<Toaster {toaster}></Toaster>

<div class="border-2 rounded-lg border-surface-200-800 h-full w-full">
	<SvelteFlow
		bind:nodes
		bind:edges
		fitView
		{nodeTypes}
		{edgeTypes}
		defaultEdgeOptions={{ type: 'pipeBranchEdge' }}
		onbeforeconnect={handleBeforeConnect}
		connectionMode="loose"
		elevateEdgesOnSelect={true}
		elevateNodesOnSelect={false}
		connectionRadius={100}
		connectionLineStyle="stroke: var(--color-surface-950-50); stroke-width: 2px;"
	>
		{#if isLassoMode}
			<PipeBranchLasso
				bind:this={lassoComponent}
				{partialSelection}
				onSelectionChange={handleLassoSelectionChange}
			/>
		{/if}

		<Panel position="top-left">
			<div class="card bg-surface-50-950 p-4 space-y-4 flex flex-col gap-2">
				<h1 class="text-lg font-semibold mb-1">{m.common_attributes()}</h1>
				<GenericCombobox
					data={branches}
					bind:value={selectedNode}
					defaultValue={selectedNode}
					placeholder={m.placeholder_select_pipe_branch()}
					onValueChange={(e) => {
						selectedNode = e.value;
						clearLassoSelection();
						if (e.value && e.value.length > 0) {
							const nodeName = e.value[0]?.name || e.value[0];
							const project = $selectedProject?.[0] || $selectedProject;
							getTrenchesNearNode(nodeName, project);
						}
					}}
					classes="bg-surface-50-950"
				/>
				<LassoModeSwitch
					checked={isLassoMode}
					onCheckedChange={handleLassoModeChange}
					partial={partialSelection}
					onPartialChange={handlePartialSelectionChange}
				/>

				{#if isLassoMode && selectedNodeIds.length > 0}
					<div class="space-y-2">
						<div class="text-sm text-surface-600-300">
							{m.common_selected()}: {selectedNodeIds.length}
							{m.form_node()}
						</div>

						{#if selectedNodeIds.length === 2}
							<button class="btn btn-sm preset-filled-primary-500" onclick={autoConnectTwoNodes}>
								{m.action_connect_selected_nodes()}
							</button>
						{:else if selectedNodeIds.length > 2}
							<div class="text-xs text-warning-500">{m.form_select_exactly_2_nodes()}</div>
						{/if}

						<button class="btn btn-sm preset-outlined-primary-500" onclick={clearLassoSelection}>
							{m.action_clear_selection()}
						</button>
					</div>
				{/if}
			</div>
		</Panel>
		<Background class="z-0" bgColor="var(--color-surface-100-900)" />
		<Controls />
	</SvelteFlow>
</div>
