<script lang="ts">
	import type { Trench } from '$lib/remote/fault-simulation/simulation-data';
	import { IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getFaultSimulationState } from './FaultSimulationState.svelte';

	const simulation = getFaultSimulationState();
</script>

{#snippet trenchInfo(trench: Trench)}
	<div class="text-sm">
		<div class="font-semibold">{trench.id_trench}</div>
		{#if trench.construction_type}
			<div class="text-xs opacity-70">{trench.construction_type}</div>
		{/if}
	</div>
{/snippet}

<!-- Anchored at the damage location. A location in the URL is already being
     simulated, so the card only reports its progress; a location picked on
     the map waits for the user to start the simulation. -->
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
			{@render trenchInfo(simulation.selectedTrench)}
		{/if}
	</div>
{:else if simulation.picked}
	<div
		class="card preset-filled-surface-50-950 shadow-xl rounded-lg p-3 w-64 space-y-2 border border-surface-200-800"
	>
		{@render trenchInfo(simulation.picked.trench)}
		<button
			type="button"
			class="btn btn-sm preset-filled-primary-500 w-full"
			onclick={() => simulation.startSimulation()}
		>
			{m.action_start_simulation()}
		</button>
	</div>
{/if}
