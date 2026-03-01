<script>
	import { m } from '$lib/paraglide/messages';

	import Chart from './Chart.svelte';
	import DonutChart from './DonutChart.svelte';
	import StackedBarChart from './StackedBarChart.svelte';

	let {
		lengthByType = [],
		lengthByStatusType = [],
		lengthByNetworkLevel = [],
		avgLengthByType = [],
		countByStatus = [],
		lengthByOwner = [],
		lengthByManufacturer = [],
		conduitsByMonth = [],
		longestConduits = []
	} = $props();

	const colors = [
		'#0ea5e9', // sky-500
		'#10b981', // emerald-500
		'#f59e0b', // amber-500
		'#ec4899', // pink-500
		'#8b5cf6', // violet-500
		'#14b8a6', // teal-500
		'#f97316', // orange-500
		'#6366f1' // indigo-500
	];

	/**
	 * Length by conduit type for bar chart
	 */
	const lengthByTypeData = $derived.by(() => {
		return lengthByType?.map((item) => ({
			label: item.type_name || m.common_unknown(),
			value: (item.total || 0) / 1000
		}));
	});

	/**
	 * Transform length by status and type into stacked bar format
	 */
	const lengthByStatusTypeData = $derived.by(() => {
		if (!lengthByStatusType || lengthByStatusType.length === 0) {
			return { labels: [], datasets: [] };
		}

		const statuses = [...new Set(lengthByStatusType.map((item) => item.status_name))];
		const types = [...new Set(lengthByStatusType.map((item) => item.type_name))];

		const datasets = types.map((type, idx) => {
			const data = statuses.map((status) => {
				const item = lengthByStatusType.find(
					(i) => i.status_name === status && i.type_name === type
				);
				return item ? (item.total || 0) / 1000 : 0;
			});
			return {
				label: type || m.common_unknown(),
				data,
				backgroundColor: colors[idx % colors.length]
			};
		});

		return {
			labels: statuses.map((s) => s || m.common_unknown()),
			datasets
		};
	});

	/**
	 * Length by network level for donut chart
	 */
	const lengthByNetworkLevelData = $derived.by(() => {
		return lengthByNetworkLevel
			?.filter((item) => item.network_level !== null)
			.map((item) => ({
				label: item.network_level || m.common_unknown(),
				value: (item.total || 0) / 1000
			}));
	});

	/**
	 * Average length by type for bar chart
	 */
	const avgLengthByTypeData = $derived.by(() => {
		return avgLengthByType?.map((item) => ({
			label: item.type_name || m.common_unknown(),
			value: item.avg_length || 0
		}));
	});

	/**
	 * Count by status for bar chart
	 */
	const countByStatusData = $derived.by(() => {
		return countByStatus?.map((item) => ({
			label: item.status_name || m.common_unknown(),
			value: item.count || 0
		}));
	});

	/**
	 * Length by owner for bar chart
	 */
	const lengthByOwnerData = $derived.by(() => {
		return lengthByOwner?.map((item) => ({
			label: item.owner_name || m.common_unknown(),
			value: (item.total || 0) / 1000
		}));
	});

	/**
	 * Length by manufacturer for donut chart
	 */
	const lengthByManufacturerData = $derived.by(() => {
		return lengthByManufacturer?.map((item) => ({
			label: item.manufacturer_name || m.common_unknown(),
			value: (item.total || 0) / 1000
		}));
	});

	/**
	 * Conduits over time for bar chart
	 */
	const conduitsByMonthData = $derived.by(() => {
		return conduitsByMonth?.map((item) => ({
			label: item.month || m.common_unknown(),
			value: item.count || 0
		}));
	});

	/**
	 * Longest conduits for bar chart
	 */
	const longestConduitsData = $derived.by(() => {
		return longestConduits?.map((item) => ({
			label: `${item.name} (${item.type_name || m.common_unknown()})`,
			value: (item.total_length || 0) / 1000
		}));
	});
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<!-- Top 5 Longest Conduits Tiles -->
	{#if longestConduits && longestConduits.length > 0}
		<div class="card border-2 border-surface-200-800 shadow-lg overflow-hidden">
			<div class="border-b-2 border-surface-200-800 p-4">
				<h3 class="h4 font-bold text-primary-500 flex items-center">
					<span>{m.form_longest_5_conduits()}</span>
					<div class="flex-1 h-px bg-primary-500 ml-4"></div>
				</h3>
			</div>
			<div class="p-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
					{#each longestConduits as conduit, i (conduit.name)}
						<div
							class="p-4 rounded-lg border-2 border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
						>
							<div class="text-xs text-surface-500 mb-1">#{i + 1}</div>
							<div class="font-semibold text-surface-900-100 truncate" title={conduit.name}>
								{conduit.name}
							</div>
							<div class="text-sm text-surface-600-400">
								{conduit.type_name || m.common_unknown()}
							</div>
							<div class="text-lg font-bold text-primary-500 mt-2">
								{((conduit.total_length || 0) / 1000).toLocaleString('de-DE', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})} km
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Length by Conduit Type -->
		<Chart data={lengthByTypeData} title={m.form_length_by_conduit_type()} color="#0ea5e9" />

		<!-- Length by Status and Type (Stacked Bar) -->
		<StackedBarChart data={lengthByStatusTypeData} title={m.form_length_by_status_and_type()} />

		<!-- Length by Network Level (Donut) -->
		<DonutChart data={lengthByNetworkLevelData} title={m.form_length_by_network_level()} />

		<!-- Average Length by Type -->
		<Chart
			data={avgLengthByTypeData}
			title={m.form_avg_length_by_type()}
			color="#10b981"
			unit="m"
		/>

		<!-- Count by Status -->
		<Chart
			data={countByStatusData}
			title={m.form_conduit_count_by_status()}
			color="#f59e0b"
			unit="x"
			axisLabel={m.common_count()}
		/>

		<!-- Length by Owner -->
		<Chart data={lengthByOwnerData} title={m.form_length_by_owner()} color="#8b5cf6" />

		<!-- Length by Manufacturer (Donut) -->
		<DonutChart data={lengthByManufacturerData} title={m.form_length_by_manufacturer()} />

		<!-- Conduits Over Time -->
		<Chart
			data={conduitsByMonthData}
			title={m.form_conduits_over_time()}
			color="#14b8a6"
			unit="x"
			axisLabel={m.common_count()}
		/>
	</div>
</div>
