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
			id: '2',
			type: 'customEdge',
			source:
				'trench-3215e953-06a3-4990-b87e-c81733fe9d20-conduit-ce0cb9d6-b699-428e-a9b8-d8edb29b9aa4', //trench-${trench.uuid}-conduit-${conduit.uuid}
			sourceHandle: 'conduit-ce0cb9d6-b699-428e-a9b8-d8edb29b9aa4-microduct-1', //conduit-${conduit.uuid}-microduct-${microduct.number}
			target:
				'trench-feca4ba3-53dd-4077-9be6-a8d706374479-conduit-f094b988-af52-4203-ac39-b2eb7f6892b8',
			targetHandle: 'conduit-f094b988-af52-4203-ac39-b2eb7f6892b8-microduct-4' //conduit-${conduit.uuid}-microduct-${microduct.number}
		}
	]);
	let nodes = $state.raw([]);

	// Helper function to parse handle ID and extract microduct data
	function parseHandleId(handleId) {
		const match = handleId.match(/conduit-(.+?)-microduct-(\d+)/);
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
				// await loadExistingConnections();
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
				`/api/microduct-connections?node_id=${encodeURIComponent(apiResponse.node_uuid)}`
			);
			if (response.ok) {
				const connections = await response.json();
				// Convert connections to edges
				const connectionEdges =
					connections.results
						?.map((conn) => {
							// Find nodes and handle IDs for this connection
							const sourceNode = nodes.find((n) =>
								n.data?.conduit?.microducts?.some((m) => m.uuid === conn.uuid_microduct_from.uuid)
							);
							const targetNode = nodes.find((n) =>
								n.data?.conduit?.microducts?.some((m) => m.uuid === conn.uuid_microduct_to.uuid)
							);

							if (!sourceNode || !targetNode) return null;

							const sourceMicroduct = sourceNode.data.conduit.microducts.find(
								(m) => m.uuid === conn.uuid_microduct_from.uuid
							);
							const targetMicroduct = targetNode.data.conduit.microducts.find(
								(m) => m.uuid === conn.uuid_microduct_to.uuid
							);

							const sourceHandleId = `conduit-${sourceNode.data.conduit.uuid}-microduct-${sourceMicroduct.number}`;
							const targetHandleId = `conduit-${targetNode.data.conduit.uuid}-microduct-${targetMicroduct.number}`;

							return {
								id: `connection-${conn.uuid}`,
								type: 'customEdge',
								source: sourceNode.id,
								target: targetNode.id,
								sourceHandle: sourceHandleId,
								targetHandle: targetHandleId,
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

	// Handle new edge connection
	async function handleConnect(connection) {
		console.log('handleConnect called with:', connection);
		const sourceMicroductUuid = getMicroductUuid(connection.source, connection.sourceHandle);
		const targetMicroductUuid = getMicroductUuid(connection.target, connection.targetHandle);
		const nodeUuid = apiResponse?.node_uuid;

		console.log('Connection data:', {
			sourceMicroductUuid,
			targetMicroductUuid,
			nodeUuid,
			apiResponse
		});

		if (!sourceMicroductUuid || !targetMicroductUuid || !nodeUuid) {
			console.error('Missing required data for connection');
			return;
		}

		try {
			const response = await fetch('/api/microduct-connections', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uuid_microduct_from: sourceMicroductUuid,
					uuid_microduct_to: targetMicroductUuid,
					uuid_node: nodeUuid
				})
			});

			if (response.ok) {
				const newConnection = await response.json();

				// Create new edge with connection data
				const newEdge = {
					id: `connection-${newConnection.uuid}`,
					type: 'customEdge',
					source: connection.source,
					target: connection.target,
					sourceHandle: connection.sourceHandle,
					targetHandle: connection.targetHandle,
					data: {
						uuid: newConnection.uuid,
						sourceHandleData: getHandleData(connection.source, connection.sourceHandle),
						targetHandleData: getHandleData(connection.target, connection.targetHandle)
					}
				};

				edges = [...edges, newEdge];
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

	// Handle edge deletion
	async function handleEdgesDelete(edgesToDelete) {
		for (const edge of edgesToDelete) {
			if (!edge.data?.uuid) continue;

			try {
				const response = await fetch(`/api/microduct-connections?uuid=${edge.data.uuid}`, {
					method: 'DELETE'
				});

				if (!response.ok) {
					const error = await response.json();
					console.error('Failed to delete connection:', error);
				}
			} catch (error) {
				console.error('Error deleting connection:', error);
			}
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
	<SvelteFlow
		bind:nodes
		bind:edges
		fitView
		{nodeTypes}
		{edgeTypes}
		onConnect={handleConnect}
		onEdgesDelete={handleEdgesDelete}
		connectionMode="loose"
	>
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
