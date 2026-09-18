<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import Chart from '$lib/components/Chart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import StackedBarChart from '$lib/components/StackedBarChart.svelte';
	import { getDashboardStatistics } from '$lib/remote/dashboard/statistics.remote';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const stats = $derived(await getDashboardStatistics({ projectId, flagId }));

	const lengthByTypeData = $derived(
		stats.conduitLengthByType.map((item) => ({
			label: item.type_name || m.common_unknown(),
			value: item.total / 1000
		}))
	);

	/**
	 * Length by status and type as stacked bars: one bar per status, one
	 * dataset per conduit type.
	 */
	const lengthByStatusTypeData = $derived.by(() => {
		const rows = stats.conduitLengthByStatusType;
		const statuses = [...new Set(rows.map((row) => row.status_name))];
		const types = [...new Set(rows.map((row) => row.type_name))];

		return {
			labels: statuses.map((status) => status || m.common_unknown()),
			datasets: types.map((type) => ({
				label: type || m.common_unknown(),
				data: statuses.map((status) => {
					const row = rows.find((r) => r.status_name === status && r.type_name === type);
					return (row?.total ?? 0) / 1000;
				})
			}))
		};
	});

	const lengthByNetworkLevelData = $derived(
		stats.conduitLengthByNetworkLevel
			.filter((item) => item.network_level !== null)
			.map((item) => ({
				label: item.network_level || m.common_unknown(),
				value: item.total / 1000
			}))
	);

	const avgLengthByTypeData = $derived(
		stats.conduitAvgLengthByType.map((item) => ({
			label: item.type_name || m.common_unknown(),
			value: item.avg_length
		}))
	);

	const countByStatusData = $derived(
		stats.conduitCountByStatus.map((item) => ({
			label: item.status_name || m.common_unknown(),
			value: item.count
		}))
	);

	const lengthByOwnerData = $derived(
		stats.conduitLengthByOwner.map((item) => ({
			label: item.owner_name || m.common_unknown(),
			value: item.total / 1000
		}))
	);

	const lengthByManufacturerData = $derived(
		stats.conduitLengthByManufacturer.map((item) => ({
			label: item.manufacturer_name || m.common_unknown(),
			value: item.total / 1000
		}))
	);

	const conduitsByMonthData = $derived(
		stats.conduitsByMonth.map((item) => ({
			label: item.month || m.common_unknown(),
			value: item.count
		}))
	);
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	{#if stats.longestConduits.length > 0}
		<div class="card border border-surface-200-800 overflow-hidden">
			<div class="border-b border-surface-200-800 px-4 py-3">
				<h3 class="font-semibold text-surface-900-100 flex items-center gap-3">
					<span>{m.form_longest_5_conduits()}</span>
					<div class="flex-1 h-px bg-surface-200-800"></div>
				</h3>
			</div>
			<div class="p-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
					{#each stats.longestConduits as conduit, i (conduit.name)}
						<div class="p-3 rounded-lg border border-surface-200-800">
							<div class="text-xs text-surface-500 mb-1">#{i + 1}</div>
							<div class="font-medium text-surface-900-100 text-sm truncate" title={conduit.name}>
								{conduit.name}
							</div>
							<div class="text-xs text-surface-600-300">
								{conduit.type_name || m.common_unknown()}
							</div>
							<div class="text-lg font-semibold text-surface-900-100 mt-2 tabular-nums">
								{(conduit.total_length / 1000).toLocaleString('de-DE', {
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
		<Chart
			data={lengthByTypeData}
			title={m.form_length_by_conduit_type()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<StackedBarChart data={lengthByStatusTypeData} title={m.form_length_by_status_and_type()} />

		<DonutChart data={lengthByNetworkLevelData} title={m.form_length_by_network_level()} />

		<Chart
			data={avgLengthByTypeData}
			title={m.form_avg_length_by_type()}
			unit="m"
			axisLabel={`${m.common_length()} (m)`}
		/>

		<Chart
			data={countByStatusData}
			title={m.form_conduit_count_by_status()}
			unit="x"
			axisLabel={m.common_count()}
		/>

		<Chart
			data={lengthByOwnerData}
			title={m.form_length_by_owner()}
			unit="km"
			axisLabel={`${m.common_length()} (km)`}
		/>

		<DonutChart data={lengthByManufacturerData} title={m.form_length_by_manufacturer()} />

		<Chart
			data={conduitsByMonthData}
			title={m.form_conduits_over_time()}
			unit="x"
			axisLabel={m.common_count()}
		/>
	</div>
</div>
