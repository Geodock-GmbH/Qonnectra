<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { getValuationRateCount } from '$lib/remote/valuation/valuation.remote';

	import { getValuationState } from '../ValuationState.svelte';

	const valuation = getValuationState();

	const rateCount = $derived(await getValuationRateCount({ projectId: valuation.projectId }));
</script>

<!-- The valuation runs from the URL; this reports what stands in its way. -->
{#if rateCount === 0}
	<p class="text-xs text-warning-600">{m.valuation_no_rates()}</p>
{:else if !valuation.selectionValid}
	<p class="text-xs text-surface-500">{m.valuation_select_area_hint()}</p>
{/if}
{#if valuation.selectionBeyondUrl}
	<p class="text-xs text-warning-600 mt-2">{m.valuation_selection_too_long()}</p>
{/if}
