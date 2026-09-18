<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import AddressStatistics from './components/AddressStatistics.svelte';
	import AreaStatistics from './components/AreaStatistics.svelte';
	import ConduitStatistics from './components/ConduitStatistics.svelte';
	import NodeStatistics from './components/NodeStatistics.svelte';
	import OverviewTab from './components/OverviewTab.svelte';
	import TrenchStatistics from './components/TrenchStatistics.svelte';

	const projectId = $derived(page.params.projectId ?? '');

	let activeTab = $state('stats');

	const tabItems = $derived([
		{ value: 'stats', label: m.common_overview() },
		{ value: 'trench', label: m.nav_trench() },
		{ value: 'conduit', label: m.nav_conduit() },
		{ value: 'node', label: m.nav_node() },
		{ value: 'address', label: m.nav_address() },
		{ value: 'area', label: m.nav_area() }
	]);
</script>

<svelte:head>
	<title>{m.nav_dashboard()}</title>
</svelte:head>

{#snippet cardsSkeleton()}
	<div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6" role="status">
		{#each { length: 6 }, i (i)}
			<div class="card border border-surface-200-800 p-4 space-y-2 animate-pulse">
				<div class="h-7 w-24 rounded bg-surface-500"></div>
				{#each { length: 3 }, row (row)}
					<div class="h-10 rounded bg-surface-500"></div>
				{/each}
			</div>
		{/each}
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<Tabs tabs={tabItems} bind:value={activeTab} orientation="horizontal">
	<QueryBoundary pending={cardsSkeleton}>
		<div class={['transition-opacity', $effect.pending() > 0 && 'opacity-60']}>
			{#if activeTab === 'stats'}
				<OverviewTab {projectId} />
			{:else if activeTab === 'trench'}
				<TrenchStatistics {projectId} />
			{:else if activeTab === 'conduit'}
				<ConduitStatistics {projectId} />
			{:else if activeTab === 'node'}
				<NodeStatistics {projectId} />
			{:else if activeTab === 'address'}
				<AddressStatistics {projectId} />
			{:else if activeTab === 'area'}
				<AreaStatistics {projectId} />
			{/if}
		</div>
	</QueryBoundary>
</Tabs>
