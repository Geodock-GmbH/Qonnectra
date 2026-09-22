<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { getValuationState } from '../ValuationState.svelte';

	const valuation = getValuationState();
</script>

<label class="block text-xs text-surface-500">
	{m.valuation_base_year()}
	<input type="number" class="input mt-1" bind:value={valuation.baseYear} placeholder="2025" />
</label>
<label class="block text-xs text-surface-500">
	{m.valuation_annual_correction()}
	<input
		type="number"
		step="0.1"
		class="input mt-1"
		bind:value={valuation.annualCorrectionPercent}
		placeholder="2.5"
	/>
</label>
<p class="text-[0.7rem] text-surface-500">{m.valuation_annual_correction_hint()}</p>
