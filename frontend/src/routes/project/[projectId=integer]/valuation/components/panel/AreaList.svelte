<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getValuationAreas } from '$lib/remote/valuation/valuation.remote';

	import { getValuationState } from '../ValuationState.svelte';
	import { groupAreasByType } from '../valuationCalc';

	const valuation = getValuationState();

	const collapsedGroups = new SvelteSet<string>();

	const areas = $derived(await getValuationAreas({ projectId: valuation.areaScope }));
	const groups = $derived(groupAreasByType(areas, m.valuation_no_area_type()));

	/** Mirrors the selected areas onto the map for as long as the list shows them. */
	function outlineSelectedAreas() {
		valuation.highlight.show(
			valuation.wholeProject
				? []
				: areas.filter((area) => valuation.selectedAreaUuids.has(area.uuid))
		);
		return () => valuation.highlight.show([]);
	}

	/**
	 * Folds a group of areas away or opens it again.
	 * @param type - The area type the group is listed under
	 */
	function toggleGroup(type: string) {
		if (!collapsedGroups.delete(type)) collapsedGroups.add(type);
	}
</script>

<div {@attach outlineSelectedAreas}>
	{#if areas.length === 0}
		<p class="text-xs text-surface-500">{m.valuation_no_areas()}</p>
	{:else}
		<div class="max-h-60 overflow-y-auto space-y-1">
			{#each groups as group (group.type)}
				{@const collapsed = collapsedGroups.has(group.type)}
				<div>
					<button
						type="button"
						class="flex items-center gap-1 w-full text-left text-sm font-medium py-1 hover:text-primary-500"
						aria-expanded={!collapsed}
						onclick={() => toggleGroup(group.type)}
					>
						{#if collapsed}
							<IconChevronRight class="size-4 shrink-0" />
						{:else}
							<IconChevronDown class="size-4 shrink-0" />
						{/if}
						<span class="truncate">{group.type}</span>
						<span class="text-xs text-surface-500 ml-auto shrink-0">{group.areas.length}</span>
					</button>
					{#if !collapsed}
						<div class="pl-5 space-y-0.5">
							{#each group.areas as area (area.uuid)}
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										class="checkbox"
										checked={valuation.selectedAreaUuids.has(area.uuid)}
										onchange={() => valuation.toggleArea(area.uuid)}
									/>
									<span class="text-sm truncate">{area.name}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
