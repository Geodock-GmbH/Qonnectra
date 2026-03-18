<script>
	import { navigating } from '$app/stores';

	import { m } from '$lib/paraglide/messages';

	import AddressStatistics from '$lib/components/AddressStatistics.svelte';
	import AreaStatistics from '$lib/components/AreaStatistics.svelte';
	import ConduitStatistics from '$lib/components/ConduitStatistics.svelte';
	import NodeStatistics from '$lib/components/NodeStatistics.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import TrenchStatistics from '$lib/components/TrenchStatistics.svelte';

	import DashboardCard from './DashboardCard.svelte';
	import DashboardProjectTable from './DashboardProjectTable.svelte';
	import WarrantyExpirationCard from './WarrantyExpirationCard.svelte';

	let { data } = $props();

	const totalNodes = $derived(
		data.nodesByType?.reduce(
			(/** @type {number} */ sum, /** @type {{ count: number }} */ item) => sum + item.count,
			0
		) || 0
	);

	const totalConduitLength = $derived(
		(data.conduitLengthByType?.reduce(
			(/** @type {number} */ sum, /** @type {{ total: number }} */ item) => sum + (item.total || 0),
			0
		) || 0) / 1000
	);

	/**
	 * @param {Array<{gesamt_länge?: number, total?: number, count?: number}>} items
	 * @param {'gesamt_länge' | 'total' | 'count'} key
	 */
	function getMaxValue(items, key) {
		if (!items?.length) return 1;
		return Math.max(...items.map((item) => Number(item[key]) || 0)) || 1;
	}

	let activeTab = $state('stats');

	const tabItems = $derived([
		{ value: 'stats', label: m.common_overview() },
		{ value: 'trench', label: m.nav_trench() },
		{ value: 'conduit', label: m.nav_conduit() },
		{ value: 'node', label: m.nav_node() },
		{ value: 'address', label: m.nav_address() },
		{ value: 'area', label: m.nav_area() },
		{ value: 'projects', label: m.form_project({ count: data.projects.length }) }
	]);
</script>

<svelte:head>
	<title>{m.nav_dashboard()}</title>
</svelte:head>

<Tabs tabs={tabItems} bind:value={activeTab} orientation="horizontal">
	{#if activeTab === 'stats'}
		<div class="space-y-6 max-w-6xl mx-auto">
			<!-- Breakdown Cards -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<DashboardCard title={m.form_trench_statistics()}>
					<div class="flex items-baseline gap-2 mb-4">
						{#if $navigating}
							<div class="h-7 bg-surface-500 rounded animate-pulse w-20"></div>
						{:else}
							<span class="text-2xl font-bold text-surface-900-100">
								{(data.totalLength / 1000).toLocaleString('de-DE', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})}
							</span>
							<span class="text-sm text-surface-600-300">km {m.form_total_length()}</span>
						{/if}
					</div>
					<div class="space-y-2 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-10 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{@const max = getMaxValue(data.lengthByTypes, 'gesamt_länge')}
							{#each data.lengthByTypes as item (`${item.bauweise}-${item.oberfläche}`)}
								{@const pct = ((item.gesamt_länge || 0) / max) * 100}
								<div class="relative rounded-lg overflow-hidden">
									<div
										class="absolute inset-y-0 left-0 bg-primary-500/20"
										style="width: {pct}%"
									></div>
									<div class="relative flex justify-between items-center p-3">
										<div>
											<div class="font-medium text-surface-900-100 text-sm">
												{item.bauweise}
											</div>
											<div class="text-xs text-surface-600-300">
												{item.oberfläche}
											</div>
										</div>
										<div class="font-semibold text-surface-900-100 tabular-nums">
											{(item.gesamt_länge / 1000).toLocaleString('de-DE', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})} km
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<DashboardCard title={m.form_node_statistics()}>
					<div class="flex items-baseline gap-2 mb-4">
						{#if $navigating}
							<div class="h-7 bg-surface-500 rounded animate-pulse w-16"></div>
						{:else}
							<span class="text-2xl font-bold text-surface-900-100">
								{totalNodes}x
							</span>
							<span class="text-sm text-surface-600-300">{m.form_total_nodes()}</span>
						{/if}
					</div>
					<div class="space-y-2 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-10 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{@const max = getMaxValue(data.nodesByType, 'count')}
							{#each data.nodesByType as item (item.node_type)}
								{@const pct = ((item.count || 0) / max) * 100}
								<div class="relative rounded-lg overflow-hidden">
									<div
										class="absolute inset-y-0 left-0 bg-primary-500/20"
										style="width: {pct}%"
									></div>
									<div class="relative flex justify-between items-center p-3">
										<div class="font-medium text-surface-900-100 text-sm">
											{item.node_type}
										</div>
										<div class="font-semibold text-surface-900-100 tabular-nums">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<DashboardCard title={m.form_conduit_statistics()}>
					<div class="flex items-baseline gap-2 mb-4">
						{#if $navigating}
							<div class="h-7 bg-surface-500 rounded animate-pulse w-20"></div>
						{:else}
							<span class="text-2xl font-bold text-surface-900-100">
								{totalConduitLength.toLocaleString('de-DE', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})}
							</span>
							<span class="text-sm text-surface-600-300">km {m.form_total_conduit_length()}</span>
						{/if}
					</div>
					<div class="space-y-2 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-10 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{@const max = getMaxValue(data.conduitLengthByType, 'total')}
							{#each data.conduitLengthByType as item (item.type_name)}
								{@const pct = ((item.total || 0) / max) * 100}
								<div class="relative rounded-lg overflow-hidden">
									<div
										class="absolute inset-y-0 left-0 bg-primary-500/20"
										style="width: {pct}%"
									></div>
									<div class="relative flex justify-between items-center p-3">
										<div class="font-medium text-surface-900-100 text-sm">
											{item.type_name}
										</div>
										<div class="font-semibold text-surface-900-100 tabular-nums">
											{((item.total || 0) / 1000).toLocaleString('de-DE', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})} km
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<DashboardCard title={m.form_address_statistics()}>
					<div class="flex items-baseline gap-4 mb-4">
						{#if $navigating}
							<div class="h-7 bg-surface-500 rounded animate-pulse w-16"></div>
						{:else}
							<div>
								<span class="text-2xl font-bold text-surface-900-100"
									>{data.totalAddresses || 0}x</span
								>
								<span class="text-sm text-surface-600-300">{m.form_total_addresses()}</span>
							</div>
							<div>
								<span class="text-2xl font-bold text-surface-900-100">{data.totalUnits || 0}x</span>
								<span class="text-sm text-surface-600-300">{m.form_total_units()}</span>
							</div>
						{/if}
					</div>
					<div class="space-y-2 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-10 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{@const max = getMaxValue(data.addressesByCity, 'count')}
							{#each data.addressesByCity as item (item.city)}
								{@const pct = ((item.count || 0) / max) * 100}
								<div class="relative rounded-lg overflow-hidden">
									<div
										class="absolute inset-y-0 left-0 bg-primary-500/20"
										style="width: {pct}%"
									></div>
									<div class="relative flex justify-between items-center p-3">
										<div class="font-medium text-surface-900-100 text-sm">
											{item.city || m.common_unknown()}
										</div>
										<div class="font-semibold text-surface-900-100 tabular-nums">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<DashboardCard title={m.form_area_statistics()}>
					<div class="flex items-baseline gap-4 mb-4">
						{#if $navigating}
							<div class="h-7 bg-surface-500 rounded animate-pulse w-16"></div>
						{:else}
							<div>
								<span class="text-2xl font-bold text-surface-900-100">{data.areaCount || 0}x</span>
								<span class="text-sm text-surface-600-300">{m.form_area_total_count()}</span>
							</div>
							<div>
								<span class="text-2xl font-bold text-surface-900-100">
									{(data.totalCoverageKm2 || 0).toLocaleString('de-DE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})}
								</span>
								<span class="text-sm text-surface-600-300">km²</span>
							</div>
						{/if}
					</div>
					<div class="space-y-2 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-10 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{@const max = getMaxValue(data.areasByType, 'count')}
							{#each data.areasByType as item (item.type_name)}
								{@const pct = ((item.count || 0) / max) * 100}
								<div class="relative rounded-lg overflow-hidden">
									<div
										class="absolute inset-y-0 left-0 bg-primary-500/20"
										style="width: {pct}%"
									></div>
									<div class="relative flex justify-between items-center p-3">
										<div class="font-medium text-surface-900-100 text-sm">
											{item.type_name || m.common_unknown()}
										</div>
										<div class="font-semibold text-surface-900-100 tabular-nums">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<WarrantyExpirationCard warranties={data.expiringWarranties} />
			</div>
		</div>
	{/if}
	{#if activeTab === 'trench'}
		<TrenchStatistics
			lengthByTypes={data.lengthByTypes}
			avgHouseConnectionLength={data.avgHouseConnectionLength}
			lengthWithFunding={data.lengthWithFunding}
			lengthWithInternalExecution={data.lengthWithInternalExecution}
			lengthByStatus={data.lengthByStatus}
			lengthByNetworkLevel={data.lengthByNetworkLevel}
			longestRoutes={data.longestRoutes}
		/>
	{/if}
	{#if activeTab === 'conduit'}
		<ConduitStatistics
			lengthByType={data.conduitLengthByType}
			lengthByStatusType={data.conduitLengthByStatusType}
			lengthByNetworkLevel={data.conduitLengthByNetworkLevel}
			avgLengthByType={data.conduitAvgLengthByType}
			countByStatus={data.conduitCountByStatus}
			lengthByOwner={data.conduitLengthByOwner}
			lengthByManufacturer={data.conduitLengthByManufacturer}
			conduitsByMonth={data.conduitsByMonth}
			longestConduits={data.longestConduits}
		/>
	{/if}
	{#if activeTab === 'node'}
		<NodeStatistics
			nodesByCity={data.nodesByCity}
			nodesByStatus={data.nodesByStatus}
			nodesByNetworkLevel={data.nodesByNetworkLevel}
			nodesByType={data.nodesByType}
			nodesByOwner={data.nodesByOwner}
			newestNodes={data.newestNodes}
		/>
	{/if}
	{#if activeTab === 'address'}
		<AddressStatistics
			addressesByCity={data.addressesByCity}
			addressesByStatus={data.addressesByStatus}
			unitsByCity={data.unitsByCity}
			unitsByType={data.unitsByType}
		/>
	{/if}
	{#if activeTab === 'area'}
		<AreaStatistics
			areaCount={data.areaCount}
			totalCoverageKm2={data.totalCoverageKm2}
			areasByType={data.areasByType}
			totalAddresses={data.areaTotalAddresses}
			addressesInAreas={data.addressesInAreas}
			totalNodes={data.totalNodes}
			nodesInAreas={data.nodesInAreas}
			totalResidentialUnits={data.totalResidentialUnits}
			residentialUnitsInAreas={data.residentialUnitsInAreas}
			addressesPerArea={data.addressesPerArea}
			addressesByAreaType={data.addressesByAreaType}
			nodesPerArea={data.nodesPerArea}
			nodesByAreaType={data.nodesByAreaType}
			trenchLengthPerArea={data.trenchLengthPerArea}
			residentialByAreaType={data.residentialByAreaType}
		/>
	{/if}
	{#if activeTab === 'projects'}
		<DashboardProjectTable data={data.projects} />
	{/if}
</Tabs>
