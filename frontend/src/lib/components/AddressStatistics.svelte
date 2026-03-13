<script>
	import { m } from '$lib/paraglide/messages';

	import Chart from './Chart.svelte';
	import DonutChart from './DonutChart.svelte';

	let { addressesByCity, addressesByStatus, unitsByCity, unitsByType } = $props();

	/**
	 * Transform addresses by city data for chart
	 * @returns {Array}
	 */
	const cityData = $derived.by(() => {
		return addressesByCity
			?.map((/** @type {{ city: string, count: number }} */ item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform addresses by status data for chart
	 * @returns {Array}
	 */
	const statusData = $derived.by(() => {
		return addressesByStatus
			?.map((/** @type {{ status: string, count: number }} */ item) => ({
				label: item.status || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform units by city data for chart
	 * @returns {Array}
	 */
	const unitsCityData = $derived.by(() => {
		return unitsByCity
			?.map((/** @type {{ city: string, count: number }} */ item) => ({
				label: item.city || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});

	/**
	 * Transform units by type data for donut chart
	 * @returns {Array}
	 */
	const unitsTypeData = $derived.by(() => {
		return unitsByType
			?.map((/** @type {{ type: string, count: number }} */ item) => ({
				label: item.type || m.common_unknown(),
				value: item.count
			}))
			.sort(
				(/** @type {{ value: number }} */ a, /** @type {{ value: number }} */ b) =>
					b.value - a.value
			);
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<!-- Chart Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<Chart
			data={cityData}
			title={m.form_addresses_by_city()}
			color="#0ea5e9"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={statusData}
			title={m.form_addresses_by_status()}
			color="#10b981"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<Chart
			data={unitsCityData}
			title={m.form_units_by_city()}
			color="#8b5cf6"
			unit="x"
			axisLabel={`${m.common_count()} (x)`}
		/>

		<DonutChart data={unitsTypeData} title={m.form_units_by_type()} />
	</div>
</div>
