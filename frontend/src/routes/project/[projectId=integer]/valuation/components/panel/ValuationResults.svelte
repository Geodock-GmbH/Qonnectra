<script lang="ts">
	import type { ValuationUnit } from '$lib/remote/valuation/valuation-data';

	import { m } from '$lib/paraglide/messages';

	import { getValuationState } from '../ValuationState.svelte';
	import { formatCurrency, formatQuantity } from '../valuationCalc';

	const valuation = getValuationState();

	const result = $derived(valuation.result);

	/**
	 * Names the unit a cost rate is charged by.
	 * @param unit - The cost rate's unit
	 * @returns The translated unit label
	 */
	function unitLabel(unit: ValuationUnit): string {
		return unit === 'per_meter' ? m.valuation_unit_per_meter() : m.valuation_unit_per_piece();
	}
</script>

{#if result}
	<div class="p-3 space-y-4">
		<div class="overflow-x-auto">
			<table class="table table-compact w-full text-sm">
				<thead>
					<tr>
						<th>{m.valuation_category()}</th>
						<th>{m.valuation_rate()}</th>
						<th>{m.valuation_quantity()}</th>
						<th>{m.valuation_gp()}</th>
					</tr>
				</thead>
				<tbody>
					{#each result.categories as category (category.name)}
						<tr>
							<td>{category.name}</td>
							<td class="whitespace-nowrap">
								{formatCurrency(category.amount)}
								<span class="text-surface-400 text-xs">/ {unitLabel(category.unit)}</span>
							</td>
							<td>{formatQuantity(category.quantity)}</td>
							<td class="whitespace-nowrap">{formatCurrency(category.totalPrice)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="font-semibold">
						<td colspan="3">{m.valuation_total()}</td>
						<td class="whitespace-nowrap">{formatCurrency(result.total)}</td>
					</tr>
				</tfoot>
			</table>
		</div>

		<div class="grid grid-cols-2 gap-2">
			<div class="card preset-tonal-primary p-3">
				<div class="text-xs text-surface-500">{m.valuation_kpi_cost_per_ha()}</div>
				<div class="text-base font-semibold">{formatCurrency(result.costPerHouseConnection)}</div>
			</div>
			<div class="card preset-tonal-primary p-3">
				<div class="text-xs text-surface-500">{m.valuation_kpi_cost_per_meter()}</div>
				<div class="text-base font-semibold">{formatCurrency(result.costPerMeter)}</div>
			</div>
		</div>

		{#if valuation.projectionRows.length > 0}
			<div class="overflow-x-auto">
				<h3 class="text-sm font-semibold mb-1 text-surface-600-400">
					{m.valuation_projection_title()}
				</h3>
				<table class="table table-compact w-full text-sm">
					<thead>
						<tr>
							<th>{m.valuation_year()}</th>
							<th>{m.valuation_net_value()}</th>
							<th>{m.valuation_increase()}</th>
						</tr>
					</thead>
					<tbody>
						{#each valuation.projectionRows as row (row.year)}
							<tr>
								<td>{row.year}</td>
								<td class="whitespace-nowrap">{formatCurrency(row.netValue)}</td>
								<td class="whitespace-nowrap">{formatCurrency(row.increase)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}
