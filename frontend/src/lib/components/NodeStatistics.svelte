<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import TrenchChart from './Chart.svelte';

	interface Props {
		nodesByCity?: Array<{ city: string; count: number }>;
		nodesByStatus?: Array<{ status: string; count: number }>;
		nodesByNetworkLevel?: Array<{ network_level?: string; count: number }>;
		nodesByType?: Array<{ node_type?: string; count: number }>;
		nodesByOwner?: Array<{ owner?: string | null; count: number }>;
		newestNodes?: Array<{ name?: string; node_type?: string }>;
	}

	let {
		nodesByCity,
		nodesByStatus,
		nodesByNetworkLevel,
		nodesByType,
		nodesByOwner,
		newestNodes
	}: Props = $props();

	/**
	 * Transform city data for chart
	 */
	const cityData = $derived.by(() => {
		return nodesByCity
			?.map((item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform status data for chart
	 */
	const statusData = $derived.by(() => {
		return nodesByStatus
			?.map((item) => ({
				label: item.status || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform network level data for chart
	 */
	const networkLevelData = $derived.by(() => {
		return nodesByNetworkLevel
			?.map((item) => ({
				label: item.network_level || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform node type data for chart
	 */
	const typeData = $derived.by(() => {
		return nodesByType
			?.map((item) => ({
				label: item.node_type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform owner data for chart
	 */
	const ownerData = $derived.by(() => {
		return nodesByOwner
			?.map((item) => ({
				label: item.owner || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform newest nodes data for chart (by name and count as 1)
	 */
	const newestNodesData = $derived.by(() => {
		return newestNodes?.map((item) => ({
			label: `${item.name} (${item.node_type || m.common_unknown()})`,
			value: 1
		}));
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<TrenchChart
			data={cityData}
			title={m.form_nodes_by_city()}
			color="#0ea5e9"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={statusData}
			title={m.form_nodes_by_status()}
			color="#10b981"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={networkLevelData}
			title={m.form_nodes_by_network_level()}
			color="#8b5cf6"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={typeData}
			title={m.form_nodes_by_type()}
			color="#f59e0b"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={ownerData}
			title={m.form_nodes_by_owner()}
			color="#ec4899"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<TrenchChart
			data={newestNodesData}
			title={m.form_newest_nodes()}
			color="#14b8a6"
			unit=""
			axisLabel={m.common_count()}
		/>
	</div>
</div>
