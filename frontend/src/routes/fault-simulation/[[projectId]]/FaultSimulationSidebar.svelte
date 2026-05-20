<script>
	import { deserialize } from '$app/forms';
	import { IconAlertTriangle, IconLoader2, IconRefresh } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	import DamageReport from './DamageReport.svelte';
	import { getFaultSimulationContext } from './faultSimulationContext.svelte.js';

	let { projectId = '' } = $props();

	const ctx = getFaultSimulationContext();

	/**
	 * Submits the selected damage point to the simulate action and updates context with the result.
	 * @returns {Promise<void>}
	 */
	async function handleSimulate() {
		if (!ctx.damagePoint || !projectId) return;

		ctx.isSimulating = true;

		try {
			const formData = new FormData();
			formData.append('pointX', String(ctx.damagePoint[0]));
			formData.append('pointY', String(ctx.damagePoint[1]));
			formData.append('projectId', projectId);

			const response = await fetch('?/simulate', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data) {
				const parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
				ctx.setSimulationResult(parsed.result ?? parsed);
			} else if (result.type === 'failure') {
				const errorMsg = result.data?.error ?? m.message_fault_simulation_error();
				globalToaster.error({
					title: m.message_fault_simulation_error(),
					description: String(errorMsg)
				});
			}
		} catch (err) {
			console.error('Simulation error:', err);
			globalToaster.error({
				title: m.message_fault_simulation_error(),
				description: String(err)
			});
		} finally {
			ctx.isSimulating = false;
		}
	}
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
	<h2 class="text-xl font-bold">{m.nav_fault_simulation()}</h2>

	{#if !ctx.damagePoint}
		<div class="card preset-outlined-surface-200-800 p-4 text-center">
			<IconAlertTriangle class="mx-auto mb-2 h-8 w-8 opacity-50" />
			<p class="text-sm opacity-70">{m.message_fault_select_trench()}</p>
		</div>
	{:else}
		{#if ctx.selectedTrench}
			<div class="card preset-outlined-surface-200-800 p-3">
				<div class="text-sm font-semibold">{m.nav_trench()}</div>
				<div class="text-lg">{ctx.selectedTrench.id_trench}</div>
				{#if ctx.selectedTrench.construction_type}
					<div class="text-sm opacity-70">
						{m.form_construction_type()}: {ctx.selectedTrench.construction_type}
					</div>
				{/if}
			</div>
		{/if}

		{#if !ctx.simulationResult}
			<button
				type="button"
				class="btn preset-filled-primary-500 w-full"
				onclick={handleSimulate}
				disabled={ctx.isSimulating}
			>
				{#if ctx.isSimulating}
					<IconLoader2 class="h-4 w-4 animate-spin" />
				{/if}
				{m.action_start_simulation()}
			</button>
		{/if}

		{#if ctx.simulationResult}
			<DamageReport />

			<button
				type="button"
				class="btn preset-outlined-surface-200-800 w-full"
				onclick={() => ctx.reset()}
			>
				<IconRefresh class="h-4 w-4" />
				{m.common_reset()}
			</button>
		{/if}
	{/if}
</div>
