<script>
	import { m } from '$lib/paraglide/messages';

	import { getFaultSimulationContext } from './faultSimulationContext.svelte.js';

	const ctx = getFaultSimulationContext();

	const result = $derived(ctx.simulationResult);
	const summary = $derived(result?.summary);
	const cables = $derived(result?.cables ?? []);
</script>

{#if result}
	<div class="space-y-4">
		{#if summary}
			<div>
				<h3 class="text-lg font-semibold mb-2">{m.fault_summary()}</h3>
				<div class="grid grid-cols-2 gap-2">
					<div class="card preset-outlined-surface-200-800 p-3">
						<div class="text-2xl font-bold">{summary.total_cables_affected}</div>
						<div class="text-sm opacity-70">{m.fault_affected_cables()}</div>
					</div>
					<div class="card preset-outlined-surface-200-800 p-3">
						<div class="text-2xl font-bold">{summary.total_fibers_affected}</div>
						<div class="text-sm opacity-70">{m.fault_fibers_affected()}</div>
					</div>
					<div class="card preset-outlined-surface-200-800 p-3">
						<div class="text-2xl font-bold text-error-500">{summary.total_fibers_dark}</div>
						<div class="text-sm opacity-70">{m.fault_dark_fibers()}</div>
					</div>
					<div class="card preset-outlined-surface-200-800 p-3">
						<div class="text-2xl font-bold text-error-500">{summary.affected_addresses}</div>
						<div class="text-sm opacity-70">{m.signal_affected_addresses()}</div>
					</div>
					<div class="card preset-outlined-surface-200-800 col-span-2 p-3">
						<div class="text-2xl font-bold text-error-500">
							{summary.affected_residential_units}
						</div>
						<div class="text-sm opacity-70">{m.signal_affected_rus()}</div>
					</div>
				</div>
			</div>
		{/if}

		{#if cables.length > 0}
			<div>
				<h3 class="text-lg font-semibold mb-2">{m.fault_affected_cables()}</h3>
				<div class="space-y-2">
					{#each cables as cable (cable.uuid)}
						<button
							type="button"
							class="card w-full text-left p-3 transition-colors {ctx.selectedCableId === cable.uuid
								? 'preset-filled-primary-500'
								: 'preset-outlined-surface-200-800 hover:preset-tonal'}"
							onclick={() =>
								ctx.setSelectedCable(ctx.selectedCableId === cable.uuid ? null : cable.uuid)}
						>
							<div class="flex justify-between items-start">
								<div>
									<div class="font-semibold">{cable.name}</div>
									<div class="text-sm opacity-70">{cable.cable_type}</div>
								</div>
								<div class="text-right">
									<div class="text-sm">
										<span class="text-error-500 font-bold">{cable.dark_fibers}</span>
										/ {cable.fiber_count}
									</div>
									<div class="text-xs opacity-70">{m.fault_dark_fibers()}</div>
								</div>
							</div>
							{#if cable.node_start?.name || cable.node_end?.name}
								<div class="text-xs mt-1 opacity-60">
									{cable.node_start?.name ?? '—'} → {cable.node_end?.name ?? '—'}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{:else if summary?.total_cables_affected === 0}
			<div class="card preset-outlined-surface-200-800 p-4 text-center opacity-70">
				{m.message_no_cables_in_trench()}
			</div>
		{/if}
	</div>
{/if}
