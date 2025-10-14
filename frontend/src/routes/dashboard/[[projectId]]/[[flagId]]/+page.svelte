<script>
	// Skeleton
	import { Tabs } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { navigating } from '$app/stores';
	import DashboardProjectTable from './DashboardProjectTable.svelte';
	let { data } = $props();
	let group = $state('stats');
</script>

<svelte:head>
	<title>{m.nav_dashboard()}</title>
</svelte:head>

<Tabs value={group} onValueChange={(e) => (group = e.value)}>
	{#snippet list()}
		<Tabs.Control value="stats">{m.common_overview()}</Tabs.Control>
		<Tabs.Control value="projects">{m.form_project({ count: data.projects.length })}</Tabs.Control>
	{/snippet}
	{#snippet content()}
		<Tabs.Panel value="stats">
			<div class="space-y-6 max-w-6xl mx-auto">
				<!-- Summary Cards Row -->
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Trench Statistics Card -->
					<div
						class="card preset-filled-surface-100-900 border border-surface-200-800 shadow-lg overflow-hidden"
					>
						<!-- Title Bar -->
						<div class="border-b border-surface-300-600 p-4">
							<h2 class="h3 font-bold text-primary-500 flex items-center">
								<span>{m.form_trench_statistics()}</span>
								<div class="flex-1 h-px bg-primary-500 ml-4"></div>
							</h2>
						</div>

						<div class="p-6">
							<div class="flex items-center gap-4 mb-6">
								<div>
									<h3 class="h4 font-semibold text-surface-800-100 mb-1">
										{m.form_total_length()}
									</h3>
									{#if $navigating}
										<div class="h-6 bg-surface-500 rounded animate-pulse w-20"></div>
									{:else}
										<div class="text-3xl font-extrabold text-surface-900-50">
											{(data.totalLength / 1000).toLocaleString('de-DE', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})} km
										</div>
									{/if}
								</div>
							</div>

							<h4 class="h5 font-semibold text-surface-800-100 mb-4">
								{m.form_breakdown_by_type()}
							</h4>
							<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
								{#if $navigating}
									{#each Array(3) as _}
										<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
									{/each}
								{:else}
									{#each data.lengthByTypes as item}
										<div
											class="flex justify-between items-center p-3 bg-surface-100-800 rounded-lg border border-surface-300-600 hover:bg-surface-200-700 transition-colors"
										>
											<div class="flex-1">
												<div class="font-medium text-surface-900-50">
													{item.bauweise}
												</div>
												<div class="text-sm text-surface-600-300">
													{item.oberfläche}
												</div>
											</div>
											<div class="text-right">
												<div class="font-bold text-lg text-primary-600-400">
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
						</div>
					</div>

					<!-- Node Statistics Card -->
					<div
						class="card preset-filled-surface-100-900 border border-surface-200-800 shadow-lg overflow-hidden"
					>
						<!-- Title Bar -->
						<div class="border-b border-surface-300-600 p-4">
							<h2 class="h3 font-bold text-primary-500 flex items-center">
								<span>{m.form_node_statistics()}</span>
								<div class="flex-1 h-px bg-primary-500 ml-4"></div>
							</h2>
						</div>

						<div class="p-6">
							<div class="flex items-center gap-4 mb-6">
								<div>
									<h3 class="h4 font-semibold text-surface-800-100 mb-1">
										{m.form_total_nodes()}
									</h3>
									{#if $navigating}
										<div class="h-6 bg-surface-500 rounded animate-pulse w-16"></div>
									{:else}
										<div class="text-3xl font-extrabold text-surface-900-50">
											{data.nodesByType?.reduce((sum, item) => sum + item.count, 0) || 0}x
										</div>
									{/if}
								</div>
							</div>

							<h4 class="h5 font-semibold text-surface-800-100 mb-4">
								{m.form_breakdown_by_node_type()}
							</h4>
							<div class="space-y-3 overflow-auto max-h-[400px] pr-2">
								{#if $navigating}
									{#each Array(3) as _}
										<div class="h-16 bg-surface-500 rounded animate-pulse"></div>
									{/each}
								{:else}
									{#each data.nodesByType as item}
										<div
											class="flex justify-between items-center p-3 bg-surface-100-800 rounded-lg border border-surface-300-600 hover:bg-surface-200-700 transition-colors"
										>
											<div class="flex-1">
												<div class="font-medium text-surface-900-50">
													{item.node_type}
												</div>
											</div>
											<div class="text-right">
												<div class="font-bold text-lg text-primary-600-400">
													{item.count}
												</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		</Tabs.Panel>
		<Tabs.Panel value="projects">
			<DashboardProjectTable data={data.projects} />
		</Tabs.Panel>
	{/snippet}
</Tabs>
