<script>
	import { m } from '$lib/paraglide/messages';

	import TrenchChart from './TrenchChart.svelte';

	let {
		lengthByTypes,
		avgHouseConnectionLength,
		lengthWithFunding,
		lengthWithInternalExecution,
		lengthByStatus,
		lengthByNetworkLevel,
		longestRoutes
	} = $props();

	/**
	 * Aggregate data by surface type
	 * @returns {Array}
	 */
	const surfaceData = $derived.by(() => {
		const aggregated = {};

		lengthByTypes?.forEach((item) => {
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

	/**
	 * Aggregate data by construction type
	 * @returns {Array}
	 */
	const constructionData = $derived.by(() => {
		const aggregated = {};

		lengthByTypes?.forEach((item) => {
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

	/**
	 * Aggregate data with average house connection length
	 * @returns {Array}
	 */
	const avgHouseConnectionData = $derived.by(() => {
		return [
			{
				label: m.form_average_house_connection_length(),
				value: avgHouseConnectionLength
			}
		];
	});

	/**
	 * Aggregate data with funding
	 * @returns {Array}
	 */
	const lengthWithFundingData = $derived.by(() => {
		return [
			{
				label: m.form_length_funded(),
				value: lengthWithFunding / 1000
			}
		];
	});

	/**
	 * Aggregate data with internal execution
	 * @returns {Array}
	 */
	const lengthWithInternalExecutionData = $derived.by(() => {
		return [
			{
				label: m.form_length_internal_execution(),
				value: lengthWithInternalExecution / 1000
			}
		];
	});

	/**
	 * Aggregate data by status
	 * @returns {Array}
	 */
	const statusData = $derived.by(() => {
		return lengthByStatus
			?.filter((item) => item.status_name !== null)
			.map((item) => ({
				label: item.status_name || m.common_unknown(),
				value: (item.gesamt_länge || 0) / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Aggregate data by network level
	 * @returns {Array}
	 */
	const networkLevelData = $derived.by(() => {
		return lengthByNetworkLevel
			?.filter((item) => item.network_level !== null)
			.map((item) => ({
				label: item.network_level || m.common_unknown(),
				value: (item.gesamt_länge || 0) / 1000
			}))
			.sort((a, b) => b.value - a.value);
	});

	/**
	 * Aggregate data by longest routes
	 * @returns {Array}
	 */
	const longestRoutesData = $derived.by(() => {
		return longestRoutes?.map((item) => ({
			label: `${item.construction_type_name || m.common_unknown()} - ${item.surface_name || m.common_unknown()}`,
			value: (item.length || 0) / 1000
		}));
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Surface Type Chart -->
		<TrenchChart data={surfaceData} title={m.form_length_by_surface()} color="#0ea5e9" />

		<!-- Construction Type Chart -->
		<TrenchChart
			data={constructionData}
			title={m.form_length_by_construction_type()}
			color="#10b981"
		/>

		<!-- Average House Connection Length -->
		<TrenchChart
			data={avgHouseConnectionData}
			title={m.form_average_house_connection_length()}
			color="#f59e0b"
			unit="m"
		/>

		<!-- Length with Funding -->
		<TrenchChart data={lengthWithFundingData} title={m.form_length_funded()} color="#8b5cf6" />

		<!-- Length with Internal Execution -->
		<TrenchChart
			data={lengthWithInternalExecutionData}
			title={m.form_length_internal_execution()}
			color="#ec4899"
		/>

		<!-- Length by Status -->
		<TrenchChart data={statusData} title={m.form_length_by_status()} color="#06b6d4" />

		<!-- Length by Network Level -->
		<TrenchChart data={networkLevelData} title={m.form_length_by_network_level()} color="#14b8a6" />

		<!-- Longest 5 Routes -->
		<TrenchChart data={longestRoutesData} title={m.form_longest_5_routes()} color="#f97316" />
	</div>
</div>
