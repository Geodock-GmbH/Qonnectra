<script>
	import { m } from '$lib/paraglide/messages';

	import DashboardCard from '../../routes/dashboard/[[projectId]]/[[flagId]]/DashboardCard.svelte';
	import Chart from './Chart.svelte';
	import DonutChart from './DonutChart.svelte';

	let {
		areaCount,
		totalCoverageKm2,
		areasByType,
		totalAddresses,
		addressesInAreas,
		totalNodes,
		nodesInAreas,
		totalResidentialUnits,
		residentialUnitsInAreas,
		addressesPerArea,
		addressesByAreaType,
		nodesPerArea,
		nodesByAreaType,
		trenchLengthPerArea,
		residentialByAreaType
	} = $props();

	/**
	 * Calculate coverage percentage
	 * @param {number} inAreas - Count within areas
	 * @param {number} total - Total count
	 * @returns {number} Percentage
	 */
	function calcPercentage(inAreas, total) {
		if (!total || total === 0) return 0;
		return Math.round((inAreas / total) * 100);
	}

	/**
	 * Transform areas by type for donut chart
	 * @returns {Array}
	 */
	const areaTypeData = $derived.by(() => {
		return areasByType
			?.map((item) => ({
				label: item.type_name || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform addresses per area for bar chart
	 * @returns {Array}
	 */
	const addressesPerAreaData = $derived.by(() => {
		return addressesPerArea
			?.map((item) => ({
				label: item.name || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform addresses by area type for bar chart
	 * @returns {Array}
	 */
	const addressesByTypeData = $derived.by(() => {
		return addressesByAreaType
			?.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform nodes per area for bar chart
	 * @returns {Array}
	 */
	const nodesPerAreaData = $derived.by(() => {
		return nodesPerArea
			?.map((item) => ({
				label: item.name || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform nodes by area type for bar chart
	 * @returns {Array}
	 */
	const nodesByTypeData = $derived.by(() => {
		return nodesByAreaType
			?.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform trench length per area for bar chart (convert to km)
	 * @returns {Array}
	 */
	const trenchLengthData = $derived.by(() => {
		return trenchLengthPerArea
			?.map((item) => ({
				label: item.name || m.common_unknown(),
				value: item.length_m / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform residential by area type for bar chart
	 * @returns {Array}
	 */
	const residentialByTypeData = $derived.by(() => {
		return residentialByAreaType
			?.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<!-- Overview Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<DashboardCard title={m.form_area_total_count()}>
			<div class="text-center">
				<div class="text-4xl font-bold text-surface-900-100">
					{areaCount ?? 0}
				</div>
			</div>
		</DashboardCard>

		<DashboardCard title={m.form_area_total_coverage()}>
			<div class="text-center">
				<div class="text-4xl font-bold text-surface-900-100">
					{(totalCoverageKm2 ?? 0).toLocaleString('de-DE', {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2
					})} km²
				</div>
			</div>
		</DashboardCard>

		<DonutChart data={areaTypeData} title={m.form_area_by_type()} />
	</div>

	<!-- Coverage Gap Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<DashboardCard title={m.form_area_address_coverage()}>
			<div class="text-center">
				<div class="text-3xl font-bold text-surface-900-100">
					{addressesInAreas ?? 0} / {totalAddresses ?? 0}
				</div>
				<div class="text-lg text-surface-600-300 mt-2">
					({calcPercentage(addressesInAreas, totalAddresses)}%)
				</div>
			</div>
		</DashboardCard>

		<DashboardCard title={m.form_area_node_coverage()}>
			<div class="text-center">
				<div class="text-3xl font-bold text-surface-900-100">
					{nodesInAreas ?? 0} / {totalNodes ?? 0}
				</div>
				<div class="text-lg text-surface-600-300 mt-2">
					({calcPercentage(nodesInAreas, totalNodes)}%)
				</div>
			</div>
		</DashboardCard>

		<DashboardCard title={m.form_area_residential_coverage()}>
			<div class="text-center">
				<div class="text-3xl font-bold text-surface-900-100">
					{residentialUnitsInAreas ?? 0} / {totalResidentialUnits ?? 0}
				</div>
				<div class="text-lg text-surface-600-300 mt-2">
					({calcPercentage(residentialUnitsInAreas, totalResidentialUnits)}%)
				</div>
			</div>
		</DashboardCard>
	</div>

	<!-- Detailed Charts -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<Chart
			data={addressesPerAreaData}
			title={m.form_area_addresses_per_area()}
			color="#0ea5e9"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={addressesByTypeData}
			title={m.form_area_addresses_by_type()}
			color="#10b981"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={nodesPerAreaData}
			title={m.form_area_nodes_per_area()}
			color="#8b5cf6"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={nodesByTypeData}
			title={m.form_area_nodes_by_type()}
			color="#f59e0b"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={trenchLengthData}
			title={m.form_area_trench_per_area()}
			color="#ec4899"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<Chart
			data={residentialByTypeData}
			title={m.form_area_residential_by_type()}
			color="#14b8a6"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>
	</div>
</div>
