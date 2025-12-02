<script>
	import { navigating } from '$app/stores';
	import { Tabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

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
		<Tabs.Trigger value="projects">{m.form_project({ count: data.projects.length })}</Tabs.Trigger>
		<Tabs.Indicator />
	</Tabs.List>
	<Tabs.Content value="stats">
		<div class="space-y-6 max-w-6xl mx-auto">
			<!-- Summary Cards Row -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Trench Statistics Card -->
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
									class="flex justify-between items-center p-3 bg-surface-100-900 rounded-lg border border-surface-800-200 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
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
										<div class="font-bold text-lg text-primary-900-100">
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

				<!-- Node Statistics Card -->
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
									{data.nodesByType?.reduce((sum, item) => sum + item.count, 0) || 0}x
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
									class="flex justify-between items-center p-3 bg-surface-100-900 rounded-lg border border-surface-800-200 hover:border-surface-200-800 hover:preset-filled-primary-500 transition-colors"
								>
									<div class="flex-1">
										<div class="font-medium text-surface-900-100">
											{item.node_type}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg text-primary-900-100">
											{item.count}x
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</DashboardCard>
			</div>

			<!-- Warranty Expiration Card -->
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
	<Tabs.Content value="projects">
		<DashboardProjectTable data={data.projects} />
	</Tabs.Content>
</Tabs>
