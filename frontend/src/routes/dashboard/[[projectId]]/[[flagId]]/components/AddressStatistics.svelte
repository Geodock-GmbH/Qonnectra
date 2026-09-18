<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import Chart from '$lib/components/Chart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import { getDashboardStatistics } from '$lib/remote/dashboard/statistics.remote';

	let { projectId }: { projectId: string } = $props();

	const stats = $derived(await getDashboardStatistics({ projectId }));

	/**
	 * Transform addresses by city data for chart
	 */
	const cityData = $derived.by(() => {
		return stats.addressesByCity
			.map((item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform addresses by status data for chart
	 */
	const statusData = $derived.by(() => {
		return stats.addressesByStatus
			.map((item) => ({
				label: item.status || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform units by city data for chart
	 */
	const unitsCityData = $derived.by(() => {
		return stats.unitsByCity
			.map((item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Transform units by type data for donut chart
	 */
	const unitsTypeData = $derived.by(() => {
		return stats.unitsByType
			.map((item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort((a, b) => b.value - a.value);
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<!-- Chart Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<Chart
			data={cityData}
			title={m.form_addresses_by_city()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={statusData}
			title={m.form_addresses_by_status()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={unitsCityData}
			title={m.form_units_by_city()}
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<DonutChart data={unitsTypeData} title={m.form_units_by_type()} />
	</div>
</div>
