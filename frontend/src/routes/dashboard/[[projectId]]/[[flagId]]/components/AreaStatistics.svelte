<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import Chart from '$lib/components/Chart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import { getDashboardStatistics } from '$lib/remote/dashboard/statistics.remote';

	import DashboardCard from './DashboardCard.svelte';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const stats = $derived(await getDashboardStatistics({ projectId, flagId }));

	/**
	 * Calculate coverage percentage
	 * @param inAreas - Count within areas
	 * @param total - Total count
	 * @returns Percentage
	 */
	function calcPercentage(inAreas: number, total: number): number {
		if (!total) return 0;
		return Math.round((inAreas / total) * 100);
	}

	const areaTypeData = $derived.by(() => {
		return stats.areasByType
			.map((item) => ({
				label: item.type_name || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const addressesPerAreaData = $derived.by(() => {
		return stats.addressesPerArea
			.map((item) => ({
				label: item.name || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const addressesByTypeData = $derived.by(() => {
		return stats.addressesByAreaType
			.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const nodesPerAreaData = $derived.by(() => {
		return stats.nodesPerArea
			.map((item) => ({
				label: item.name || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const nodesByTypeData = $derived.by(() => {
		return stats.nodesByAreaType
			.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	const trenchLengthData = $derived.by(() => {
		return stats.trenchLengthPerArea
			.map((item) => ({
				label: item.name || m.common_unknown(),
				value: item.length_m / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	const residentialByTypeData = $derived.by(() => {
		return stats.residentialByAreaType
			.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<DashboardCard title={m.form_area_total_count()}>
			<div class="text-center">
				<div class="text-4xl font-bold text-surface-900-100">
					{stats.areaCount}
				</div>
			</div>
		</DashboardCard>

		<DashboardCard title={m.form_area_total_coverage()}>
			<div class="text-center">
				<div class="text-4xl font-bold text-surface-900-100">
					{stats.totalCoverageKm2.toLocaleString('de-DE', {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2
					})} km²
				</div>
			</div>
		</DashboardCard>

		<DonutChart data={areaTypeData} title={m.form_area_by_type()} />
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<DashboardCard title={m.form_area_address_coverage()}>
			<div class="text-center">
				<div class="text-3xl font-bold text-surface-900-100">
					{stats.addressesInAreas} / {stats.areaTotalAddresses}
				</div>
				<div class="text-lg text-surface-600-300 mt-2">
					({calcPercentage(stats.addressesInAreas, stats.areaTotalAddresses)}%)
				</div>
			</div>
		</DashboardCard>

		<DashboardCard title={m.form_area_node_coverage()}>
			<div class="text-center">
				<div class="text-3xl font-bold text-surface-900-100">
					{stats.nodesInAreas} / {stats.totalNodes}
				</div>
				<div class="text-lg text-surface-600-300 mt-2">
					({calcPercentage(stats.nodesInAreas, stats.totalNodes)}%)
				</div>
			</div>
		</DashboardCard>

		<DashboardCard title={m.form_area_residential_coverage()}>
			<div class="text-center">
				<div class="text-3xl font-bold text-surface-900-100">
					{stats.residentialUnitsInAreas} / {stats.totalResidentialUnits}
				</div>
				<div class="text-lg text-surface-600-300 mt-2">
					({calcPercentage(stats.residentialUnitsInAreas, stats.totalResidentialUnits)}%)
				</div>
			</div>
		</DashboardCard>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<Chart
			data={addressesPerAreaData}
			title={m.form_area_addresses_per_area()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={addressesByTypeData}
			title={m.form_area_addresses_by_type()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={nodesPerAreaData}
			title={m.form_area_nodes_per_area()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={nodesByTypeData}
			title={m.form_area_nodes_by_type()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={trenchLengthData}
			title={m.form_area_trench_per_area()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={residentialByTypeData}
			title={m.form_area_residential_by_type()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>
	</div>
</div>
