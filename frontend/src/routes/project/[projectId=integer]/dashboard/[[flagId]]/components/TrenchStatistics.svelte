<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import Chart from '$lib/components/Chart.svelte';
	import { getDashboardStatistics } from '$lib/remote/dashboard/statistics.remote';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const stats = $derived(await getDashboardStatistics({ projectId, flagId }));

	const surfaceData = $derived.by(() => {
		const aggregated: Record<string, number> = {};

		stats.lengthByTypes.forEach((item) => {
			if (!aggregated[item.oberfläche]) {
				aggregated[item.oberfläche] = 0;
			}
			aggregated[item.oberfläche] += item.gesamt_länge;
		});

		return Object.entries(aggregated)
			.map(([label, value]) => ({
				label,
				value: value / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	const constructionData = $derived.by(() => {
		const aggregated: Record<string, number> = {};

		stats.lengthByTypes.forEach((item) => {
			if (!aggregated[item.bauweise]) {
				aggregated[item.bauweise] = 0;
			}
			aggregated[item.bauweise] += item.gesamt_länge;
		});

		return Object.entries(aggregated)
			.map(([label, value]) => ({
				label,
				value: value / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	const avgHouseConnectionData = $derived.by(() => {
		return [
			{
				label: m.form_average_house_connection_length(),
				value: stats.avgHouseConnectionLength
			}
		];
	});

	const lengthWithFundingData = $derived.by(() => {
		return [
			{
				label: m.form_length_funded(),
				value: stats.lengthWithFunding / 1000
			}
		];
	});

	const lengthWithInternalExecutionData = $derived.by(() => {
		return [
			{
				label: m.form_length_internal_execution(),
				value: stats.lengthWithInternalExecution / 1000
			}
		];
	});

	const statusData = $derived.by(() => {
		return stats.lengthByStatus
			.filter((item) => item.status_name !== null)
			.map((item) => ({
				label: item.status_name || m.common_unknown(),
				value: (item.gesamt_länge || 0) / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	const networkLevelData = $derived.by(() => {
		return stats.lengthByNetworkLevel
			.filter((item) => item.network_level !== null)
			.map((item) => ({
				label: item.network_level || m.common_unknown(),
				value: (item.gesamt_länge || 0) / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	const longestRoutesData = $derived.by(() => {
		return stats.longestRoutes.map((item) => ({
			label: `${item.construction_type_name || m.common_unknown()} - ${item.surface_name || m.common_unknown()}`,
			value: (item.length || 0) / 1000
		}));
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<Chart
			data={surfaceData}
			title={m.form_length_by_surface()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={constructionData}
			title={m.form_length_by_construction_type()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={avgHouseConnectionData}
			title={m.form_average_house_connection_length()}
			unit="m"
			axisLabel={`${m.common_length()} (m)`}
		/>

		<Chart
			data={lengthWithFundingData}
			title={m.form_length_funded()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={lengthWithInternalExecutionData}
			title={m.form_length_internal_execution()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={statusData}
			title={m.form_length_by_status()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={networkLevelData}
			title={m.form_length_by_network_level()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={longestRoutesData}
			title={m.form_longest_5_routes()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>
	</div>
</div>
