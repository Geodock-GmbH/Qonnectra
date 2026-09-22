<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { getValuationState } from '../ValuationState.svelte';

	const valuation = getValuationState();

	/**
	 * The number an input holds, or undefined while it is empty.
	 * @param event - The input's change event.
	 */
	function numberOf(event: Event): number | undefined {
		const text = (event.currentTarget as HTMLInputElement).value.trim();
		return text === '' ? undefined : Number(text);
	}
</script>

<!-- The inputs live in the URL; a change commits when the field is left. -->
<label class="block text-xs text-surface-500">
	{m.valuation_base_year()}
	<input
		type="number"
		class="input mt-1"
		value={valuation.baseYear}
		onchange={(event) => valuation.setBaseYear(numberOf(event))}
		placeholder="2025"
	/>
</label>
<label class="block text-xs text-surface-500">
	{m.valuation_annual_correction()}
	<input
		type="number"
		step="0.1"
		class="input mt-1"
		value={valuation.annualCorrectionPercent}
		onchange={(event) => valuation.setAnnualCorrection(numberOf(event))}
		placeholder="2.5"
	/>
</label>
<p class="text-[0.7rem] text-surface-500">{m.valuation_annual_correction_hint()}</p>
