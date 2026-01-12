<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Background, Controls, Panel, SvelteFlow } from '@xyflow/svelte';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { autoLockSvelteFlow } from '$lib/utils/svelteFlowLock';

	import LassoModeSwitch from './LassoModeSwitch.svelte';
	import PipeBranchEdge from './PipeBranchEdge.svelte';
	import PipeBranchLasso from './PipeBranchLasso.svelte';
	import PipeBranchNode from './PipeBranchNode.svelte';
	import TrenchSelector from './TrenchSelector.svelte';

	import '@xyflow/svelte/dist/style.css';

	import { m } from '$lib/paraglide/messages';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
	let selectedNode = $state([]);
	let branches = $derived(data?.nodes && Array.isArray(data.nodes) ? data.nodes : []);
	let pipeBranchConfigured = $derived(data?.pipeBranchConfigured || false);
	let apiResponse = $state(null);
	let trenches = $derived(apiResponse?.trenches || []);

	let availableTrenches = $state([]);
	let showTrenchSelector = $state(false);
	let selectedKeys = $state([]);
	let lockedKeys = $state([]);

	let isLassoMode = $state(false);
	let partialSelection = $state(false);
	let selectedNodeIds = $state([]);
	let lassoComponent = $state(null);

	/**
	 * Auto lock the svelte flow
	 */
	onMount(async () => {
		await autoLockSvelteFlow();
	});

	const nodeTypes = { pipeBranch: PipeBranchNode };
	const edgeTypes = { pipeBranchEdge: PipeBranchEdge };
	let edges = $state.raw([]);
	let nodes = $state.raw([]);

	/**
	 * Parse the handle id
	 * @param {string} handleId - The handle id
	 * @returns {object} - The parsed handle id
	 */
	function parseHandleId(handleId) {
		const baseHandleId = handleId.replace(/-(source|target)$/, '');
		const match = baseHandleId.match(/conduit-(.+?)-microduct-(\d+)/);
		if (!match) return null;
		return {
			conduitUuid: match[1],
			microductNumber: parseInt(match[2])
		};
	}

	/**
	 * Get the microduct uuid
	 * @param {string} nodeId - The node id
	 * @param {string} handleId - The handle id
	 * @returns {string} - The microduct uuid
	 */
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

	/**
	 * Get the handle data
	 * @param {string} nodeId - The node id
	 * @param {string} handleId - The handle id
	 * @returns {object} - The handle data
	 */
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

	/**
	 * Parse the dehydrated response
	 * @param {array} response - The response
	 * @returns {array} - The parsed response
	 */
	function parseDehydratedResponse(response) {
		if (!Array.isArray(response)) return response;

		function resolveValue(index) {
			if (typeof index !== 'number') return index;
			const value = response[index];

			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				const resolved = {};
				for (const [key, valueIndex] of Object.entries(value)) {
					resolved[key] = resolveValue(valueIndex);
				}
				return resolved;
			}

			if (Array.isArray(value)) {
				return value.map(resolveValue);
			}

			return value;
		}

		const metadata = response[0];
		if (metadata?.type === 1 && metadata?.data) {
			return resolveValue(metadata.data);
		}

		return response;
	}

	/**
	 * Effect to update the nodes
	 */
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

				const angle = (nodeIndex * 2 * Math.PI) / totalNodes;
				const x = centerX + circleRadius * Math.cos(angle);
				const y = centerY + circleRadius * Math.sin(angle);

				conduitNodes.push({
					id: `trench-${trench.uuid}-conduit-${conduit.uuid}`,
					type: 'pipeBranch',
					position: {
						x: x,
						y: y
					},
					selected: false,
					zIndex: 1,
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

	/**
	 * Get the trenches near node
	 * @param {string} nodeName - The node name
	 * @param {string} project - The project
	 */
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

				if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
					parsedData = parseDehydratedResponse(parsedData);
				}

				availableTrenches = parsedData.trenches || [];
				apiResponse = { ...parsedData, trenches: [] };

				if (availableTrenches.length === 0) {
					globalToaster.warning({
						title: m.common_warning(),
						description: m.message_no_trenches_near_node()
					});
					return;
				}

				await loadSavedSelectionsAndConnections();
				showTrenchSelector = true;
			} else {
				console.error('Failed to fetch trenches near node:', await response.text());
				apiResponse = null;
				availableTrenches = [];
			}
		} catch (error) {
			console.error('Error fetching trenches near node:', error);
			apiResponse = null;
			availableTrenches = [];
		}
	}

	/**
	 * Make a key
	 * @param {string} trenchUuid - The trench uuid
	 * @param {string} conduitUuid - The conduit uuid
	 * @returns {string} - The key
	 */
	function makeKey(trenchUuid, conduitUuid) {
		return `${trenchUuid}:${conduitUuid}`;
	}

	/**
	 * Load the saved selections and connections
	 */
	async function loadSavedSelectionsAndConnections() {
		if (!apiResponse?.node_uuid) return;

		try {
			const selectionsFormData = new FormData();
			selectionsFormData.append('node_uuid', apiResponse.node_uuid);
			const selectionsResponse = await fetch('?/getTrenchSelections', {
				method: 'POST',
				body: selectionsFormData
			});

			let savedTrenchUuids = [];
			if (selectionsResponse.ok) {
				let rawResponse = await selectionsResponse.json();
				let parsedData = JSON.parse(rawResponse.data);
				if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
					parsedData = parseDehydratedResponse(parsedData);
				}
				savedTrenchUuids = (parsedData || []).map((s) => s.trench);
			}

			const connectionsFormData = new FormData();
			connectionsFormData.append('node_id', apiResponse.node_uuid);
			const connectionsResponse = await fetch('?/getConnections', {
				method: 'POST',
				body: connectionsFormData
			});

			let lockedKeysFromConnections = [];
			if (connectionsResponse.ok) {
				let rawResponse = await connectionsResponse.json();
				let parsedData = JSON.parse(rawResponse.data);
				if (Array.isArray(parsedData) && parsedData[0]?.type === 1) {
					parsedData = parseDehydratedResponse(parsedData);
				}
				const connections = parsedData || [];
				const connectedKeys = new Set();
				connections.forEach((conn) => {
					const conduitFromUuid = conn.uuid_microduct_from?.uuid_conduit?.uuid;
					const trenchFromUuid = conn.uuid_trench_from?.id;
					if (conduitFromUuid && trenchFromUuid) {
						connectedKeys.add(makeKey(trenchFromUuid, conduitFromUuid));
					}

					const conduitToUuid = conn.uuid_microduct_to?.uuid_conduit?.uuid;
					const trenchToUuid = conn.uuid_trench_to?.id;
					if (conduitToUuid && trenchToUuid) {
						connectedKeys.add(makeKey(trenchToUuid, conduitToUuid));
					}
				});
				lockedKeysFromConnections = Array.from(connectedKeys);
			}

			lockedKeys = lockedKeysFromConnections;

			const savedKeys = availableTrenches
				.filter((t) => savedTrenchUuids.includes(t.uuid))
				.flatMap((t) => t.conduits?.map((c) => makeKey(t.uuid, c.uuid)) || []);

			const allPreselected = new Set([...savedKeys, ...lockedKeysFromConnections]);
			selectedKeys = Array.from(allPreselected);
		} catch (error) {
			console.error('Error loading saved selections:', error);
			selectedKeys = [];
			lockedKeys = [];
		}
	}

	/**
	 * Handle the trench selection confirm
	 * @param {array} selectedTrenches - The selected trenches
	 */
	async function handleTrenchSelectionConfirm(selectedTrenches) {
		showTrenchSelector = false;

		if (apiResponse?.node_uuid) {
			try {
				const formData = new FormData();
				formData.append('node_uuid', apiResponse.node_uuid);
				formData.append('trench_uuids', JSON.stringify(selectedTrenches.map((t) => t.uuid)));

				await fetch('?/saveTrenchSelections', {
					method: 'POST',
					body: formData
				});
			} catch (error) {
				console.error('Error saving trench selections:', error);
			}
		}

		if (apiResponse) {
			apiResponse = {
				...apiResponse,
				trenches: selectedTrenches
			};
		}

		await loadExistingConnections();
	}

	/**
	 * Handle the trench selection cancel
	 */
	function handleTrenchSelectionCancel() {
		showTrenchSelector = false;
		availableTrenches = [];
		apiResponse = null;
		selectedKeys = [];
		lockedKeys = [];
	}

	/**
	 * Load the existing connections
	 */
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
				const connectionEdges =
					connections
						?.map((conn) => {
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
								zIndex: 10,
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

	/**
	 * Handle the before connect
	 * @param {object} connection - The connection
	 * @returns {object} - The connection
	 */
	function handleBeforeConnect(connection) {
		const sourceHandleData = getHandleData(connection.source, connection.sourceHandle);
		const targetHandleData = getHandleData(connection.target, connection.targetHandle);

		if (connection.sourceHandle && connection.sourceHandle.endsWith('-target')) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_cannot_connect_from_source()
			});
			return false;
		}

		if (sourceHandleData.microductUuid === targetHandleData.microductUuid) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_cannot_connect_microduct_to_itself()
			});
			return false;
		}

		return connection;
	}

	/**
	 * Effect to update the edges
	 */
	$effect(() => {
		if (!edges || !nodes) return;

		edges.forEach((edge, index) => {
			if (edge.id.startsWith('xy-edge__') && (!edge.data || Object.keys(edge.data).length === 0)) {
				const sourceHandleData = getHandleData(edge.source, edge.sourceHandle);
				const targetHandleData = getHandleData(edge.target, edge.targetHandle);

				if (sourceHandleData.microductUuid && targetHandleData.microductUuid) {
					const updatedEdges = [...edges];
					updatedEdges[index] = {
						...edge,
						zIndex: 10,
						data: {
							uuid: null,
							sourceHandleData,
							targetHandleData
						}
					};
					edges = updatedEdges;

					const sourceMicroductUuid = getMicroductUuid(edge.source, edge.sourceHandle);
					const targetMicroductUuid = getMicroductUuid(edge.target, edge.targetHandle);
					const nodeUuid = apiResponse?.node_uuid;

					if (sourceMicroductUuid && targetMicroductUuid && nodeUuid) {
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

	/**
	 * Save the connection
	 * @param {object} edge - The edge
	 * @param {string} sourceMicroductUuid - The source microduct uuid
	 * @param {string} targetMicroductUuid - The target microduct uuid
	 * @param {string} nodeUuid - The node uuid
	 * @param {string} sourceTrenchUuid - The source trench uuid
	 * @param {string} targetTrenchUuid - The target trench uuid
	 */
	async function saveConnection(
		edge,
		sourceMicroductUuid,
		targetMicroductUuid,
		nodeUuid,
		sourceTrenchUuid,
		targetTrenchUuid
	) {
		try {
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

	/**
	 * Handle the lasso selection change
	 * @param {array} selectedIds - The selected ids
	 */
	function handleLassoSelectionChange(selectedIds) {
		selectedNodeIds = selectedIds;
	}

	/**
	 * Handle the lasso mode change
	 * @param {object} event - The event
	 */
	function handleLassoModeChange(event) {
		isLassoMode = event.checked;
		if (!isLassoMode) {
			selectedNodeIds = [];
			if (lassoComponent?.clearSelection) {
				lassoComponent.clearSelection();
			}
		}
	}

	/**
	 * Handle the partial selection change
	 * @param {boolean} partial - The partial
	 */
	function handlePartialSelectionChange(partial) {
		partialSelection = partial;
	}

	/**
	 * Clear the lasso selection
	 */
	function clearLassoSelection() {
		selectedNodeIds = [];
		if (lassoComponent?.clearSelection) {
			lassoComponent.clearSelection();
		}
	}

	/**
	 * Check if the edge exists
	 * @param {string} sourceMicroductUuid - The source microduct uuid
	 * @param {string} targetMicroductUuid - The target microduct uuid
	 * @returns {boolean} - True if the edge exists, false otherwise
	 */
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

	/**
	 * Auto connect two nodes
	 */
	async function autoConnectTwoNodes() {
		if (selectedNodeIds.length !== 2) {
			globalToaster.error({
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
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_could_not_find_selected_nodes()
			});
			return;
		}

		const sourceMicroducts = sourceNode.data?.conduit?.microducts || [];
		const targetMicroducts = targetNode.data?.conduit?.microducts || [];

		const connections = [];
		for (const sourceMd of sourceMicroducts) {
			const targetMd = targetMicroducts.find((t) => t.number === sourceMd.number);
			if (targetMd) {
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
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_no_matching_microducts()
			});
			return;
		}

		try {
			let successCount = 0;
			for (const conn of connections) {
				const tempEdgeId = `temp-edge-${Date.now()}-${Math.random()}`;

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
					edges = edges.filter((edge) => edge.id !== tempEdgeId);
					console.error('Failed to create connection:', await response.text());
				}
			}

			if (successCount > 0) {
				globalToaster.success({
					title: m.title_success(),
					description: `${successCount}x ${m.message_created_connections()}`
				});
			}

			if (successCount < connections.length) {
				globalToaster.error({
					title: m.common_error(),
					description: `${connections.length - successCount}x ${m.message_failed_to_create_connections()}`
				});
			}
		} catch (error) {
			console.error('Error creating connections:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_failed_to_create_connections()
			});
		}
	}

	/**
	 * Effect to update the project
	 */
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
		connectionLineStyle="stroke: var(--color-surface-50-950); stroke-width: 2px;"
	>
		{#if isLassoMode}
			<PipeBranchLasso
				bind:this={lassoComponent}
				{partialSelection}
				onSelectionChange={handleLassoSelectionChange}
			/>
		{/if}

		<Panel position="top-left">
			{#if showTrenchSelector}
				<TrenchSelector
					trenches={availableTrenches}
					bind:selectedKeys
					{lockedKeys}
					onConfirm={handleTrenchSelectionConfirm}
					onCancel={handleTrenchSelectionCancel}
				/>
			{:else}
				<div class="card preset-filled-surface-50-950 p-4 space-y-4 flex flex-col gap-2">
					<h1 class="text-lg font-semibold mb-1">{m.common_attributes()}</h1>

					{#if !pipeBranchConfigured && branches.length > 0}
						<div class="text-sm text-warning-500 bg-warning-500/10 p-2 rounded">
							{m.message_pipe_branch_not_configured()}
						</div>
					{/if}

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
						inputClasses="min-w-[240px]"
					/>

					{#if selectedNode?.length > 0 && availableTrenches.length > 0}
						<button
							type="button"
							class="btn preset-filled-warning-500 hover:preset-filled-warning-600"
							onclick={async () => {
								await loadSavedSelectionsAndConnections();
								showTrenchSelector = true;
							}}
						>
							{m.action_edit_trench_selection()}
						</button>
					{/if}

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

							<button class="btn btn-sm preset-filled-warning-500" onclick={clearLassoSelection}>
								{m.action_clear_selection()}
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</Panel>
		<Background class="z-0" bgColor="var(--color-surface-100-900)" />
		<Controls />
	</SvelteFlow>
</div>
