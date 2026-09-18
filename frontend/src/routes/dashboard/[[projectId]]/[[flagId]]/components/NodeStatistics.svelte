<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import Chart from '$lib/components/Chart.svelte';
	import { getDashboardStatistics } from '$lib/remote/dashboard/statistics.remote';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const stats = $derived(await getDashboardStatistics({ projectId, flagId }));

	const cityData = $derived.by(() => {
		return stats.nodesByCity
			.map((item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const statusData = $derived.by(() => {
		return stats.nodesByStatus
			.map((item) => ({
				label: item.status || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const networkLevelData = $derived.by(() => {
		return stats.nodesByNetworkLevel
			.map((item) => ({
				label: item.network_level || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const typeData = $derived.by(() => {
		return stats.nodesByType
			.map((item) => ({
				label: item.node_type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const ownerData = $derived.by(() => {
		return stats.nodesByOwner
			.map((item) => ({
				label: item.owner || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const newestNodesData = $derived.by(() => {
		return stats.newestNodes.map((item) => ({
			label: `${item.name} (${item.node_type || m.common_unknown()})`,
			value: 1
		}));
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<Chart
			data={cityData}
			title={m.form_nodes_by_city()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={statusData}
			title={m.form_nodes_by_status()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={networkLevelData}
			title={m.form_nodes_by_network_level()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={typeData}
			title={m.form_nodes_by_type()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={ownerData}
			title={m.form_nodes_by_owner()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={newestNodesData}
			title={m.form_newest_nodes()}
			unit=""
			axisLabel={m.common_count()}
		/>
	</div>
</div>
