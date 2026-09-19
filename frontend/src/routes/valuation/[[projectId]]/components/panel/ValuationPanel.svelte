<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import { getValuationState } from '../ValuationState.svelte';
	import AreaList from './AreaList.svelte';
	import CalculateButton from './CalculateButton.svelte';
	import ProjectionInputs from './ProjectionInputs.svelte';
	import ValuationResults from './ValuationResults.svelte';

	const valuation = getValuationState();
</script>

{#snippet listSkeleton()}
	<div class="space-y-2 animate-pulse" role="status">
		<div class="h-4 w-1/2 rounded bg-surface-200-800"></div>
		<div class="h-4 w-2/3 rounded bg-surface-200-800"></div>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

{#snippet buttonSkeleton()}
	<div class="placeholder animate-pulse h-10 rounded-md" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="p-3 border-b border-surface-200-800 space-y-2">
	<h2 class="text-sm font-semibold text-surface-600-400">{m.valuation_area_select()}</h2>

	<label class="flex items-center gap-2 cursor-pointer">
		<input
			type="checkbox"
			class="checkbox"
			checked={valuation.wholeProject}
			onchange={() => valuation.toggleWholeProject()}
		/>
		<span class="text-sm">{m.valuation_area_gesamt()}</span>
	</label>

	<QueryBoundary pending={listSkeleton}>
		<AreaList />
	</QueryBoundary>
</div>

<div class="p-3 border-b border-surface-200-800 space-y-2">
	<h2 class="text-sm font-semibold text-surface-600-400">{m.valuation_projection_title()}</h2>
	<ProjectionInputs />
</div>

<div class="p-3 border-b border-surface-200-800">
	<QueryBoundary pending={buttonSkeleton}>
		<CalculateButton />
	</QueryBoundary>
</div>

<ValuationResults />
