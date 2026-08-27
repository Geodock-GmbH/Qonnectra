<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import TrenchChart from './Chart.svelte';

	interface LengthByType {
		oberfläche: string;
		bauweise: string;
		gesamt_länge: number;
	}

	/**
	 * The aggregation props below carry backend rows whose exact shape is not
	 * declared consistently across callers, so they are typed loosely; the
	 * derived aggregations read the fields they need defensively.
	 */
	interface Props {
		lengthByTypes?: LengthByType[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		avgHouseConnectionLength: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		lengthWithFunding: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		lengthWithInternalExecution: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		lengthByStatus?: any[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		lengthByNetworkLevel?: any[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		longestRoutes?: any[];
	}

	let {
		lengthByTypes,
		avgHouseConnectionLength,
		lengthWithFunding,
		lengthWithInternalExecution,
		lengthByStatus,
		lengthByNetworkLevel,
		longestRoutes
	}: Props = $props();

	/**
	 * Aggregate data by surface type
	 */
	const surfaceData = $derived.by(() => {
		const aggregated: Record<string, number> = {};

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
	 */
	const constructionData = $derived.by(() => {
		const aggregated: Record<string, number> = {};

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
		<TrenchChart
			data={surfaceData}
			title={m.form_length_by_surface()}
			color="#0ea5e9"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<!-- Construction Type Chart -->
		<TrenchChart
			data={constructionData}
			title={m.form_length_by_construction_type()}
			color="#10b981"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<!-- Average House Connection Length -->
		<TrenchChart
			data={avgHouseConnectionData}
			title={m.form_average_house_connection_length()}
			color="#f59e0b"
			unit="m"
			axisLabel={`${m.common_length()} (m)`}
		/>

		<!-- Length with Funding -->
		<TrenchChart
			data={lengthWithFundingData}
			title={m.form_length_funded()}
			color="#8b5cf6"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<!-- Length with Internal Execution -->
		<TrenchChart
			data={lengthWithInternalExecutionData}
			title={m.form_length_internal_execution()}
			color="#ec4899"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<!-- Length by Status -->
		<TrenchChart
			data={statusData}
			title={m.form_length_by_status()}
			color="#06b6d4"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<!-- Length by Network Level -->
		<TrenchChart
			data={networkLevelData}
			title={m.form_length_by_network_level()}
			color="#14b8a6"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<!-- Longest 5 Routes -->
		<TrenchChart
			data={longestRoutesData}
			title={m.form_longest_5_routes()}
			color="#f97316"
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>
	</div>
</div>
