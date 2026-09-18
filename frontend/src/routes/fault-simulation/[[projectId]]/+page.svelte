<script lang="ts">
	import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { selectedProject } from '$lib/stores/store';

	import DamageReport from './components/DamageReport.svelte';
	import FaultSimulationMap from './components/FaultSimulationMap.svelte';
	import {
		FaultSimulationState,
		setFaultSimulationState
	} from './components/FaultSimulationState.svelte';

	if (browser && page.params.projectId && page.params.projectId !== get(selectedProject)) {
		selectedProject.set(page.params.projectId);
	}

	const simulation = setFaultSimulationState(new FaultSimulationState());

	const projectId = $derived(page.params.projectId ?? $selectedProject);

	onMount(() => {
		if (!dev) return;

		window.__e2eFaultSim = {
			injectResult(result: FaultSimulationResult) {
				simulation.selectDamagePoint([0, 0], [0, 0], result.trench ?? null);
				simulation.showResult(result);
			},
			reset() {
				simulation.reset();
			}
		};

		return () => {
			delete window.__e2eFaultSim;
		};
	});
</script>

<svelte:head>
	<title>{m.nav_fault_simulation()}</title>
</svelte:head>

{#snippet mapSkeleton()}
	<div
		class="h-full w-full rounded-lg border-2 border-surface-200-800 placeholder animate-pulse"
		role="status"
	>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="flex flex-col h-full overflow-hidden">
	<div class={simulation.simulationResult ? 'h-1/2 shrink-0' : 'flex-1'}>
		<QueryBoundary pending={mapSkeleton}>
			<FaultSimulationMap {projectId} />
		</QueryBoundary>
	</div>

	{#if simulation.simulationResult}
		<div class="flex-1 min-h-0 border-t border-surface-200-800 mt-2">
			<DamageReport {projectId} />
		</div>
	{/if}
</div>
