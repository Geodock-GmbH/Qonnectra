<script>
	// Skeleton
	import { Combobox, createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';

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

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
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
		const circleRadius = Math.max(300, totalNodes * 30);

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
			const response = await fetch(
				`/api/trench-near-nodes?node_name=${encodeURIComponent(nodeName)}&project=${project}`
			);
			if (response.ok) {
				apiResponse = await response.json();
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
			const response = await fetch(
				`/api/microduct-connections/?node_id=${encodeURIComponent(apiResponse.node_uuid)}`
			);
			if (response.ok) {
				const connections = await response.json();
				// Convert connections to edges
				const connectionEdges =
					connections.results
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
		console.log('handleBeforeConnect called with:', connection);

		// Get handle data for validation
		const sourceHandleData = getHandleData(connection.source, connection.sourceHandle);
		const targetHandleData = getHandleData(connection.target, connection.targetHandle);

		// Prevent connecting a microduct to itself
		if (sourceHandleData.microductUuid === targetHandleData.microductUuid) {
			toaster.error({
				title: m.error(),
				description: m.error_cannot_connect_microduct_to_itself()
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
				console.log('Detected new edge without data:', edge);

				// Extract connection info from the edge
				const sourceHandleData = getHandleData(edge.source, edge.sourceHandle);
				const targetHandleData = getHandleData(edge.target, edge.targetHandle);

				if (sourceHandleData.microductUuid && targetHandleData.microductUuid) {
					console.log('Populating edge data for:', edge.id);

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

						console.log('About to save connection with values:', {
							sourceMicroductUuid,
							targetMicroductUuid,
							nodeUuid,
							sourceTrenchUuid,
							targetTrenchUuid,
							sourceType: typeof sourceMicroductUuid,
							targetType: typeof targetMicroductUuid,
							nodeType: typeof nodeUuid
						});
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

			const response = await fetch('/api/microduct-connections/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uuid_microduct_from: fromUuid,
					uuid_microduct_to: toUuid,
					uuid_node: nodeUuidValue,
					uuid_trench_from: sourceTrenchUuidValue,
					uuid_trench_to: targetTrenchUuidValue
				})
			});

			if (response.ok) {
				const newConnection = await response.json();

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
					console.log('Updated edge with backend UUID:', newConnection.uuid);
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
	>
		<Panel position="top-left">
			<div class="card bg-surface-50-950">
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
					classes="bg-surface-50-950"
				/>
			</div>
		</Panel>
		<Background class="z-0" bgColor="var(--color-surface-100-900)" />
		<Controls />
	</SvelteFlow>
</div>
