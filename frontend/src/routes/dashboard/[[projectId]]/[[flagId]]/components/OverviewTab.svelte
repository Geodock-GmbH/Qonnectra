<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { getDashboardStatistics } from '$lib/remote/dashboard/statistics.remote';

	import BreakdownCard from './BreakdownCard.svelte';
	import WarrantyExpirationCard from './WarrantyExpirationCard.svelte';

	let { projectId, flagId }: { projectId: string; flagId: string } = $props();

	const stats = $derived(await getDashboardStatistics({ projectId, flagId }));

	const totalNodes = $derived(stats.nodesByType.reduce((sum, item) => sum + item.count, 0));
	const totalConduitLength = $derived(
		stats.conduitLengthByType.reduce((sum, item) => sum + item.total, 0)
	);

	/**
	 * Formats a length in meters as kilometers with two decimals.
	 * @param meters - Length in meters.
	 */
	function formatKm(meters: number): string {
		return formatDecimal(meters / 1000);
	}

	/**
	 * Formats a number with two decimals in German notation.
	 * @param value - Number to format.
	 */
	function formatDecimal(value: number): string {
		return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="space-y-6 max-w-6xl mx-auto">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<BreakdownCard
			title={m.form_trench_statistics()}
			totals={[{ value: formatKm(stats.totalLength), label: `km ${m.form_total_length()}` }]}
			rows={stats.lengthByTypes.map((item) => ({
				key: `${item.bauweise}-${item.oberfläche}`,
				label: item.bauweise,
				sublabel: item.oberfläche,
				value: item.gesamt_länge,
				display: `${formatKm(item.gesamt_länge)} km`
			}))}
		/>

		<BreakdownCard
			title={m.form_node_statistics()}
			totals={[{ value: `${totalNodes}x`, label: m.form_total_nodes() }]}
			rows={stats.nodesByType.map((item) => ({
				key: item.node_type,
				label: item.node_type,
				value: item.count,
				display: `${item.count}x`
			}))}
		/>

		<BreakdownCard
			title={m.form_conduit_statistics()}
			totals={[
				{ value: formatKm(totalConduitLength), label: `km ${m.form_total_conduit_length()}` }
			]}
			rows={stats.conduitLengthByType.map((item) => ({
				key: String(item.type_name),
				label: item.type_name || m.common_unknown(),
				value: item.total,
				display: `${formatKm(item.total)} km`
			}))}
		/>

		<BreakdownCard
			title={m.form_address_statistics()}
			totals={[
				{ value: `${stats.totalAddresses}x`, label: m.form_total_addresses() },
				{ value: `${stats.totalUnits}x`, label: m.form_total_units() }
			]}
			rows={stats.addressesByCity.map((item) => ({
				key: String(item.city),
				label: item.city || m.common_unknown(),
				value: item.count,
				display: `${item.count}x`
			}))}
		/>

		<BreakdownCard
			title={m.form_area_statistics()}
			totals={[
				{ value: `${stats.areaCount}x`, label: m.form_area_total_count() },
				{ value: formatDecimal(stats.totalCoverageKm2), label: 'km²' }
			]}
			rows={stats.areasByType.map((item) => ({
				key: String(item.type_name),
				label: item.type_name || m.common_unknown(),
				value: item.count,
				display: `${item.count}x`
			}))}
		/>

		<WarrantyExpirationCard warranties={stats.expiringWarranties} />
	</div>
</div>
