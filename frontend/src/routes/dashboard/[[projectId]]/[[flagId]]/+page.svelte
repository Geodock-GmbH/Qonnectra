<script>
	// Skeleton
	import { Tabs } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { navigating, page } from '$app/stores';
	import { selectedProject } from '$lib/stores/store';
	import { goto } from '$app/navigation';
	let { data } = $props();
	let group = $state('stats');

	$effect(() => {
		const projectId = $selectedProject;
		const currentPath = $page.url.pathname;

		if (projectId) {
			const targetPath = `/dashboard/${projectId}`;
			if (currentPath !== targetPath) {
				goto(targetPath, { keepFocus: true, noScroll: true, replaceState: true });
			}
		}
	});
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<Tabs value={group} onValueChange={(e) => (group = e.value)}>
	{#snippet list()}
		<Tabs.Control value="stats">{m.overview()}</Tabs.Control>
		<Tabs.Control value="projects">{m.projects()}</Tabs.Control>
		<Tabs.Control value="activities">{m.activities()}</Tabs.Control>
	{/snippet}
	{#snippet content()}
		<Tabs.Panel value="stats">
			<!-- Trench Card -->
			<div class="card preset-filled-surface-50-900 p-6 shadow-lg max-w-4xl mx-auto">
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
					<!-- Total Length Section -->
					<div class="text-center lg:text-left">
						<h2 class="h2 font-bold text-primary-500 mb-2">{m.total_length()}</h2>
						{#if $navigating}
							<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
						{:else}
							<div class="text-4xl font-extrabold text-surface-900-50">
								{(data.totalLength / 1000).toLocaleString('de-DE', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2
								})} km
							</div>
						{/if}
					</div>

					<!-- Breakdown Section -->
					<div>
						<h3 class="h3 font-semibold text-surface-800-100 mb-4">{m.breakdown_by_type()}</h3>
						<div class="space-y-3 overflow-auto max-h-[500px]">
							{#if $navigating}
								<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
							{:else}
								{#each data.lengthByTypes as item}
									<div class="flex justify-between items-center p-3 bg-surface-100-800 rounded-lg">
										<div class="flex-1">
											<div class="font-medium text-surface-900-50 text-sm">
												{item.bauweise}
											</div>
											<div class="text-xs text-surface-600-300">
												{item.oberfläche}
											</div>
										</div>
										<div class="text-right">
											<div class="font-semibold text-surface-900-50">
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
			</div>
			<!-- Nodes Card -->
			<div class="card preset-filled-surface-50-900 p-6 shadow-lg max-w-4xl mx-auto">
				<div>
					<h3 class="h3 font-semibold text-surface-800-100 mb-4">{m.breakdown_by_node_type()}</h3>
					<div class="space-y-3 overflow-auto max-h-[500px]">
						{#if $navigating}
							<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
						{:else}
							{#each data.nodesByType as item}
								<div class="flex justify-between items-center p-3 bg-surface-100-800 rounded-lg">
									<div class="flex-1">
										<div class="font-medium text-surface-900-50 text-sm">
											{item.node_type}
										</div>
										<div class="text-xs text-surface-600-300">
											{item.count}
										</div>
									</div>
									<div class="text-right">
										<div class="font-semibold text-surface-900-50">
											{item.count}
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</Tabs.Panel>
		<Tabs.Panel value="projects">
			<!-- TODO: Add projects -->
		</Tabs.Panel>
		<Tabs.Panel value="activities">
			<!-- TODO: Add activities -->
		</Tabs.Panel>
	{/snippet}
</Tabs>
