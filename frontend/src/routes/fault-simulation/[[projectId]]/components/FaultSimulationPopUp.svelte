<script lang="ts">
	import { IconLoader2 } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { simulateFault } from '$lib/remote/fault-simulation/simulation.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import { getFaultSimulationState } from './FaultSimulationState.svelte';

	let { projectId = '' }: { projectId?: string } = $props();

	const simulation = getFaultSimulationState();

	/**
	 * Runs the simulation for the selected damage point and hands the result to the shared state.
	 */
	async function handleSimulate(): Promise<void> {
		if (!simulation.damagePoint || !projectId) return;

		simulation.isSimulating = true;

		try {
			simulation.showResult(await simulateFault({ point: simulation.damagePoint, projectId }));
		} catch (err) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Simulation error',
				extraData: {
					from: 'FaultSimulationPopUp.handleSimulate',
					error: remoteErrorMessage(err) ?? String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.message_fault_simulation_error(),
				description: remoteErrorMessage(err) ?? m.message_fault_simulation_error()
			});
		} finally {
			simulation.isSimulating = false;
		}
	}
</script>

{#if simulation.damagePoint}
	<div
		class="card preset-filled-surface-50-950 shadow-xl rounded-lg p-3 w-64 space-y-2 border border-surface-200-800"
	>
		{#if simulation.selectedTrench}
			<div class="text-sm">
				<div class="font-semibold">{simulation.selectedTrench.id_trench}</div>
				{#if simulation.selectedTrench.construction_type}
					<div class="text-xs opacity-70">{simulation.selectedTrench.construction_type}</div>
				{/if}
			</div>
		{/if}

		<button
			type="button"
			class="btn btn-sm preset-filled-primary-500 w-full"
			onclick={handleSimulate}
			disabled={simulation.isSimulating}
		>
			{#if simulation.isSimulating}
				<IconLoader2 class="h-4 w-4 animate-spin" />
			{/if}
			{m.action_start_simulation()}
		</button>
	</div>
{/if}
