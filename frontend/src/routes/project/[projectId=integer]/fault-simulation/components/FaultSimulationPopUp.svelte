<script lang="ts">
	import { IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getFaultSimulationState } from './FaultSimulationState.svelte';

	const simulation = getFaultSimulationState();
</script>

<!-- Anchored at the damage location: the simulation runs from the URL, so
     this only reports its progress and the trench it found. -->
{#if simulation.damagePoint}
	<div
		class="card preset-filled-surface-50-950 shadow-xl rounded-lg p-3 w-64 space-y-2 border border-surface-200-800"
		role="status"
	>
		{#if simulation.isSimulating}
			<div class="flex items-center gap-2 text-sm">
				<IconLoader2 class="h-4 w-4 animate-spin" />
				{m.action_start_simulation()}
			</div>
		{:else if simulation.selectedTrench}
			<div class="text-sm">
				<div class="font-semibold">{simulation.selectedTrench.id_trench}</div>
				{#if simulation.selectedTrench.construction_type}
					<div class="text-xs opacity-70">{simulation.selectedTrench.construction_type}</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
