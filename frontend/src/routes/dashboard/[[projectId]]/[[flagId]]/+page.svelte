<script>
	import { navigating } from '$app/stores';
	import { Tabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import AddressStatistics from '$lib/components/AddressStatistics.svelte';
	import AreaStatistics from '$lib/components/AreaStatistics.svelte';
	import ConduitStatistics from '$lib/components/ConduitStatistics.svelte';
	import NodeStatistics from '$lib/components/NodeStatistics.svelte';
	import TrenchStatistics from '$lib/components/TrenchStatistics.svelte';

	import DashboardCard from './DashboardCard.svelte';
	import DashboardProjectTable from './DashboardProjectTable.svelte';
	import WarrantyExpirationCard from './WarrantyExpirationCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.nav_dashboard()}</title>
</svelte:head>

<Tabs defaultValue="stats">
	<Tabs.List>
		<Tabs.Trigger value="stats">{m.common_overview()}</Tabs.Trigger>
		<Tabs.Trigger value="trench">{m.nav_trench()}</Tabs.Trigger>
		<Tabs.Trigger value="conduit">{m.nav_conduit()}</Tabs.Trigger>
		<Tabs.Trigger value="node">{m.nav_node()}</Tabs.Trigger>
		<Tabs.Trigger value="address">{m.nav_address()}</Tabs.Trigger>
		<Tabs.Trigger value="area">{m.nav_area()}</Tabs.Trigger>
		<Tabs.Trigger value="projects">{m.form_project({ count: data.projects.length })}</Tabs.Trigger>
		<Tabs.Indicator />
	</Tabs.List>
	<Tabs.Content value="stats">
		<div class="space-y-6 max-w-6xl mx-auto">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<DashboardCard title={m.form_trench_statistics()}>
					<div class="flex items-center gap-4 mb-6">
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_total_length()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-20"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{(data.totalLength / 1000).toLocaleString('de-DE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})} km
								</div>
							{/if}
						</div>
					</div>

					<h4 class="h5 font-semibold text-surface-900-100 mb-4">
						{m.form_breakdown_by_type()}
					</h4>
					<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{#each data.lengthByTypes as item (`${item.bauweise}-${item.oberfläche}`)}
								<div
									class="flex justify-between items-center p-3 rounded-lg border border-surface-200-800 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
								>
									<div class="flex-1">
										<div class="font-medium text-surface-900-100">
											{item.bauweise}
										</div>
										<div class="text-sm text-surface-900-100">
											{item.oberfläche}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg text-surface-900-100">
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
					<div class="flex items-center gap-4 mb-6">
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_total_nodes()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-16"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{data.nodesByType?.reduce((/** @type {number} */ sum, /** @type {{ count: number }} */ item) => sum + item.count, 0) || 0}x
								</div>
							{/if}
						</div>
					</div>

					<h4 class="h5 font-semibold text-surface-900-100 mb-4">
						{m.form_breakdown_by_node_type()}
					</h4>
					<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{#each data.nodesByType as item (item.node_type)}
								<div
									class="flex justify-between items-center p-3 rounded-lg border border-surface-200-800 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
								>
									<div class="flex-1">
										<div class="font-medium text-surface-900-100">
											{item.node_type}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg text-surface-900-100">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<DashboardCard title={m.form_conduit_statistics()}>
					<div class="flex items-center gap-4 mb-6">
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_total_conduit_length()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-20"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{(
										data.conduitLengthByType?.reduce((/** @type {number} */ sum, /** @type {{ total: number }} */ item) => sum + (item.total || 0), 0) /
										1000
									).toLocaleString('de-DE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})} km
								</div>
							{/if}
						</div>
					</div>

					<h4 class="h5 font-semibold text-surface-900-100 mb-4">
						{m.form_breakdown_by_type()}
					</h4>
					<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{#each data.conduitLengthByType as item (item.type_name)}
								<div
									class="flex justify-between items-center p-3 rounded-lg border border-surface-200-800 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
								>
									<div class="flex-1">
										<div class="font-medium text-surface-900-100">
											{item.type_name}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg text-surface-900-100">
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
					<div class="flex items-center gap-4 mb-6">
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_total_addresses()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-16"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{data.totalAddresses || 0}x
								</div>
							{/if}
						</div>
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_total_units()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-16"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{data.totalUnits || 0}x
								</div>
							{/if}
						</div>
					</div>

					<h4 class="h5 font-semibold text-surface-900-100 mb-4">
						{m.form_breakdown_by_city()}
					</h4>
					<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{#each data.addressesByCity as item (item.city)}
								<div
									class="flex justify-between items-center p-3 rounded-lg border border-surface-200-800 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
								>
									<div class="flex-1">
										<div class="font-medium text-surface-900-100">
											{item.city || m.common_unknown()}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg text-surface-900-100">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>

				<DashboardCard title={m.form_area_statistics()}>
					<div class="flex items-center gap-4 mb-6">
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_area_total_count()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-16"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{data.areaCount || 0}x
								</div>
							{/if}
						</div>
						<div>
							<h3 class="h4 font-semibold text-surface-900-100 mb-1">
								{m.form_area_total_coverage()}
							</h3>
							{#if $navigating}
								<div class="h-6 bg-surface-500 rounded animate-pulse w-20"></div>
							{:else}
								<div class="text-3xl font-extrabold text-surface-900-100">
									{(data.totalCoverageKm2 || 0).toLocaleString('de-DE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})} km²
								</div>
							{/if}
						</div>
					</div>

					<h4 class="h5 font-semibold text-surface-900-100 mb-4">
						{m.form_breakdown_by_type()}
					</h4>
					<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
						{#if $navigating}
							{#each Array(3) as _, i (i)}
								<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
							{/each}
						{:else}
							{#each data.areasByType as item (item.type_name)}
								<div
									class="flex justify-between items-center p-3 rounded-lg border border-surface-200-800 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
								>
									<div class="flex-1">
										<div class="font-medium text-surface-900-100">
											{item.type_name || m.common_unknown()}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg text-surface-900-100">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>
			</div>

			<div class="grid grid-cols-1 gap-6">
				<WarrantyExpirationCard warranties={data.expiringWarranties} />
			</div>
		</div>
	</Tabs.Content>
	<Tabs.Content value="trench">
		<TrenchStatistics
			lengthByTypes={data.lengthByTypes}
			avgHouseConnectionLength={data.avgHouseConnectionLength}
			lengthWithFunding={data.lengthWithFunding}
			lengthWithInternalExecution={data.lengthWithInternalExecution}
			lengthByStatus={data.lengthByStatus}
			lengthByNetworkLevel={data.lengthByNetworkLevel}
			longestRoutes={data.longestRoutes}
		/>
	</Tabs.Content>
	<Tabs.Content value="conduit">
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
	</Tabs.Content>
	<Tabs.Content value="node">
		<NodeStatistics
			nodesByCity={data.nodesByCity}
			nodesByStatus={data.nodesByStatus}
			nodesByNetworkLevel={data.nodesByNetworkLevel}
			nodesByType={data.nodesByType}
			nodesByOwner={data.nodesByOwner}
			newestNodes={data.newestNodes}
		/>
	</Tabs.Content>
	<Tabs.Content value="address">
		<AddressStatistics
			addressesByCity={data.addressesByCity}
			addressesByStatus={data.addressesByStatus}
			unitsByCity={data.unitsByCity}
			unitsByType={data.unitsByType}
		/>
	</Tabs.Content>
	<Tabs.Content value="area">
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
	</Tabs.Content>
	<Tabs.Content value="projects">
		<DashboardProjectTable data={data.projects} />
	</Tabs.Content>
</Tabs>
