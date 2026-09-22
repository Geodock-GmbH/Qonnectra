<script lang="ts">
	import type { ValuationUnit } from '$lib/remote/valuation/valuation-data';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import { getValuationState } from '../ValuationState.svelte';
	import ValuationResultTable from './ValuationResultTable.svelte';
	import { formatCurrency, formatQuantity } from '../valuationCalc';

	const valuation = getValuationState();

	/**
	 * Names the unit a cost rate is charged by.
	 * @param unit - The cost rate's unit
	 * @returns The translated unit label
	 */
	function unitLabel(unit: ValuationUnit): string {
		return unit === 'per_meter' ? m.valuation_unit_per_meter() : m.valuation_unit_per_piece();
	}
</script>

{#snippet calculating()}
	<p class="flex items-center gap-2 p-3 text-sm" role="status">
		<span class="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
		></span>
		{m.valuation_calculating()}
	</p>
{/snippet}

<!-- The valuation runs from the URL; the boundary carries its progress and failure. -->
{#if valuation.selectionValid}
	<QueryBoundary pending={calculating} class="m-3">
		<ValuationResultTable {unitLabel} {formatCurrency} {formatQuantity} />
	</QueryBoundary>
{/if}
