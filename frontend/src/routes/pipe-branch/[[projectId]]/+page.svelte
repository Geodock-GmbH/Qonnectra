<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Background, ConnectionMode, Controls, Panel, SvelteFlow } from '@xyflow/svelte';

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

	/** @type {{ data: import('./$types').PageData }} */
	let { data } = $props();
	/** @type {any[]} */
	let selectedNode = $state([]);
	let branches = $derived(data?.nodes && Array.isArray(data.nodes) ? data.nodes : []);
	let pipeBranchConfigured = $derived(data?.pipeBranchConfigured || false);
	/** @type {any} */
	let apiResponse = $state(null);
	let trenches = $derived(apiResponse?.trenches || []);

	/** @type {any[]} */
	let availableTrenches = $state([]);
	let showTrenchSelector = $state(false);
	/** @type {string[]} */
	let selectedKeys = $state([]);
	/** @type {string[]} */
	let lockedKeys = $state([]);

	let isLassoMode = $state(false);
	let partialSelection = $state(false);
	/** @type {string[]} */
	let selectedNodeIds = $state([]);
	/** @type {PipeBranchLasso | null} */
	let lassoComponent = $state(null);

	onMount(async () => {
		await autoLockSvelteFlow();
	});

	const nodeTypes = { pipeBranch: PipeBranchNode };
	/** @type {any} */
	const edgeTypes = { pipeBranchEdge: PipeBranchEdge };
	/** @type {any[]} */
	let edges = $state.raw([]);
	/** @type {any[]} */
	let nodes = $state.raw([]);

	/**
	 * Extracts conduit UUID and microduct number from a handle ID string.
	 * @param {string} handleId - Handle ID in format `conduit-<uuid>-microduct-<number>(-source|-target)`
	 * @returns {{conduitUuid: string, microductNumber: number} | null} Parsed components, or null if format is invalid.
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
	 * Resolves the microduct UUID from a flow node ID and handle ID.
	 * @param {string} nodeId - SvelteFlow node ID
	 * @param {string} handleId - Handle ID containing conduit/microduct identifiers
	 * @returns {string | null} Microduct UUID, or null if not found.
	 */
	function getMicroductUuid(nodeId, handleId) {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node?.data?.conduit?.microducts) return null;

		const handleData = parseHandleId(handleId);
		if (!handleData) return null;

		const microduct = node.data.conduit.microducts.find(
			(/** @type {any} */ m) => m.number === handleData.microductNumber
		);
		return microduct?.uuid || null;
	}

	/**
	 * Retrieves microduct and conduit metadata for a given handle on a node.
	 * @param {string} nodeId - SvelteFlow node ID
	 * @param {string} handleId - Handle ID containing conduit/microduct identifiers
	 * @returns {{microductUuid?: string, microductNumber?: number, conduitName?: string, conduitUuid?: string}} Handle metadata, or empty object if not found.
	 */
	function getHandleData(nodeId, handleId) {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node?.data?.conduit?.microducts) return {};

		const handleData = parseHandleId(handleId);
		if (!handleData) return {};

		const microduct = node.data.conduit.microducts.find(
			(/** @type {any} */ m) => m.number === handleData.microductNumber
		);

		return {
			microductUuid: microduct?.uuid,
			microductNumber: handleData.microductNumber,
			conduitName: node.data.conduit.name,
			conduitUuid: node.data.conduit.uuid
		};
	}

	/**
	 * Resolves a SvelteKit dehydrated response array back into its original data structure.
	 * @param {Array<unknown>} response - Dehydrated response array from SvelteKit form actions
	 * @returns {unknown} Resolved data structure, or the original input if not dehydrated.
	 */
	function parseDehydratedResponse(response) {
		if (!Array.isArray(response)) return response;

		/** @returns {any} */
		function resolveValue(/** @type {any} */ index) {
			if (typeof index !== 'number') return index;
			const value = response[index];

			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				/** @type {Record<string, any>} */
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

		const metadata = /** @type {any} */ (response[0]);
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

		/** @type {any[]} */
		const conduitNodes = [];
		let nodeIndex = 0;

		let totalNodes = 0;
		trenches.forEach((/** @type {any} */ trench) => {
			if (trench.conduits && trench.conduits.length > 0) {
				totalNodes += trench.conduits.length;
			}
		});

		const centerX = 400;
		const centerY = 300;
		const circleRadius = Math.max(800, totalNodes * 50);

		trenches.forEach((/** @type {any} */ trench) => {
			if (!trench.conduits || trench.conduits.length === 0) {
				return;
			}

			trench.conduits.forEach((/** @type {any} */ conduit) => {
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
	 * Fetches trenches near a node and initiates the trench selection flow.
	 * @param {string} nodeName - Name of the node to search near
	 * @param {string} project - Project ID to scope the query
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
	 * Creates a composite key for trench-conduit pair identification.
	 * @param {string} trenchUuid - Trench UUID
	 * @param {string} conduitUuid - Conduit UUID
	 * @returns {string} Composite key in format `trenchUuid:conduitUuid`.
	 */
	function makeKey(trenchUuid, conduitUuid) {
		return `${trenchUuid}:${conduitUuid}`;
	}

	/**
	 * Loads saved trench selections and existing connections to pre-populate and lock the selection UI.
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
				savedTrenchUuids = (parsedData || []).map((/** @type {any} */ s) => s.trench);
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
				connections.forEach((/** @type {any} */ conn) => {
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
				.flatMap((t) => t.conduits?.map((/** @type {any} */ c) => makeKey(t.uuid, c.uuid)) || []);

			const allPreselected = new Set([...savedKeys, ...lockedKeysFromConnections]);
			selectedKeys = Array.from(allPreselected);
		} catch (error) {
			console.error('Error loading saved selections:', error);
			selectedKeys = [];
			lockedKeys = [];
		}
	}

	/**
	 * Persists the trench selection, applies it to the canvas, and loads existing connections.
	 * @param {Array<{uuid: string, conduits: Array<unknown>}>} selectedTrenches - Trenches with their selected conduits
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
	 * Resets the trench selection UI and clears all related state.
	 */
	function handleTrenchSelectionCancel() {
		showTrenchSelector = false;
		availableTrenches = [];
		apiResponse = null;
		selectedKeys = [];
		lockedKeys = [];
	}

	/**
	 * Fetches existing microduct connections and renders them as edges on the SvelteFlow canvas.
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
						?.map((/** @type {any} */ conn) => {
							const sourceNode = nodes.find(
								(n) =>
									n.data?.trench?.uuid === conn.uuid_trench_from.id &&
									n.data?.conduit?.microducts?.some((/** @type {any} */ m) => m.uuid === conn.uuid_microduct_from.uuid)
							);
							const targetNode = nodes.find(
								(n) =>
									n.data?.trench?.uuid === conn.uuid_trench_to.id &&
									n.data?.conduit?.microducts?.some((/** @type {any} */ m) => m.uuid === conn.uuid_microduct_to.uuid)
							);

							if (!sourceNode || !targetNode) return null;

							const sourceMicroduct = sourceNode.data.conduit.microducts.find(
								(/** @type {any} */ m) => m.uuid === conn.uuid_microduct_from.uuid
							);
							const targetMicroduct = targetNode.data.conduit.microducts.find(
								(/** @type {any} */ m) => m.uuid === conn.uuid_microduct_to.uuid
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
	 * Validates a connection attempt before it is created in SvelteFlow.
	 * @param {import('@xyflow/svelte').Connection} connection - Proposed connection
	 * @returns {import('@xyflow/svelte').Connection | false} The connection if valid, or false to reject.
	 */
	function handleBeforeConnect(connection) {
		const sourceHandleData = getHandleData(connection.source, connection.sourceHandle ?? '');
		const targetHandleData = getHandleData(connection.target, connection.targetHandle ?? '');

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

	/** Detects newly created edges from SvelteFlow and persists them to the backend. */
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
	 * Persists a microduct connection to the backend and updates the edge with the returned UUID.
	 * @param {import('@xyflow/svelte').Edge} edge - The SvelteFlow edge to persist
	 * @param {string} sourceMicroductUuid - Source microduct UUID
	 * @param {string} targetMicroductUuid - Target microduct UUID
	 * @param {string} nodeUuid - Node UUID where the connection occurs
	 * @param {string} sourceTrenchUuid - Source trench UUID
	 * @param {string} targetTrenchUuid - Target trench UUID
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
	 * @param {string[]} selectedIds - Currently lasso-selected node IDs
	 */
	function handleLassoSelectionChange(selectedIds) {
		selectedNodeIds = selectedIds;
	}

	/**
	 * @param {{checked: boolean}} event - Switch change event
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
	 * @param {boolean} partial - Whether partial (corner-based) selection is enabled
	 */
	function handlePartialSelectionChange(partial) {
		partialSelection = partial;
	}

	/**
	 * Clears the current lasso selection and resets the lasso component.
	 */
	function clearLassoSelection() {
		selectedNodeIds = [];
		if (lassoComponent?.clearSelection) {
			lassoComponent.clearSelection();
		}
	}

	/**
	 * Checks whether an edge already exists between two microducts (in either direction).
	 * @param {string} sourceMicroductUuid - Source microduct UUID
	 * @param {string} targetMicroductUuid - Target microduct UUID
	 * @returns {boolean}
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
	 * Connects all matching microducts (by number) between two lasso-selected nodes.
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
			const targetMd = targetMicroducts.find((/** @type {any} */ t) => t.number === sourceMd.number);
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
		connectionMode={ConnectionMode.Loose}
		elevateEdgesOnSelect={true}
		elevateNodesOnSelect={false}
		connectionRadius={100}
		connectionLineStyle="stroke: var(--color-surface-50-950); stroke-width: 2px;"
	>
		{#if isLassoMode}
			<PipeBranchLasso
				bind:this={lassoComponent}
				partial={partialSelection}
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
						onValueChange={(/** @type {any} */ e) => {
							selectedNode = e.value;
							clearLassoSelection();
							if (e.value && e.value.length > 0) {
								const nodeName = e.value[0]?.name || e.value[0];
								const project = $selectedProject;
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
