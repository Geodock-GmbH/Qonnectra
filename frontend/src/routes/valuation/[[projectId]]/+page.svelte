<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { globalMapView, selectedProject } from '$lib/stores/store';

	import ValuationPanel from './components/panel/ValuationPanel.svelte';
	import ValuationMap from './components/ValuationMap.svelte';
	import { setValuationState, ValuationState } from './components/ValuationState.svelte';

	if (browser && page.params.projectId && page.params.projectId !== get(selectedProject)) {
		selectedProject.set(page.params.projectId);
	}

	const valuation = setValuationState(new ValuationState());

	onMount(() => {
		const subscriptions = [
			selectedProject.subscribe(() => valuation.reset()),
			globalMapView.subscribe(() => valuation.reset())
		];

		return () => subscriptions.forEach((unsubscribe) => unsubscribe());
	});
</script>

<svelte:head>
	<title>{m.nav_valuation()}</title>
</svelte:head>

{#snippet mapSkeleton()}
	<div class="h-full w-full placeholder animate-pulse" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="flex flex-col h-full p-4">
	<div class="flex-1 flex flex-col lg:flex-row lg:gap-4 overflow-hidden">
		<div
			class="order-1 h-[40vh] shrink-0 border-2 rounded-lg border-surface-200-800 overflow-hidden relative sm:h-[45vh] lg:h-auto lg:flex-2"
		>
			<QueryBoundary pending={mapSkeleton}>
				<ValuationMap />
			</QueryBoundary>
		</div>

		<div
			class="order-2 min-w-0 flex-1 border-2 rounded-lg border-surface-200-800 overflow-y-auto flex flex-col pb-16 md:pb-0 lg:w-160 lg:flex-none lg:shrink-0"
		>
			<ValuationPanel />
		</div>
	</div>
</div>
