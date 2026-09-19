<script lang="ts">
	import type { Fiber } from '$lib/classes/CableFiberDataManager.svelte';
	import type { FiberColor } from '$lib/server/nodeData';
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { IconChevronDown } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { fiberColorHex } from '$lib/utils/fiberColors';
	import { getFiberColors, getFibersForCable } from '$lib/remote/network-schema/fibers.remote';

	import { getTraceSearchState } from './TraceSearchState.svelte';
	import { groupFibersByBundle } from './fiberBundles';

	let { cableUuid }: { cableUuid: string } = $props();

	const search = getTraceSearchState();

	const fibersQuery = $derived(getFibersForCable(cableUuid));
	const colorsQuery = getFiberColors().catch((): FiberColor[] => []);

	const fibers = $derived(await fibersQuery);
	const colors = $derived(await colorsQuery);

	const bundles = $derived(groupFibersByBundle(fibers));

	/** Bundles whose expansion the user flipped; a lone bundle starts expanded. */
	const toggledBundles = new SvelteSet<number>();

	/**
	 * @param bundleNumber - The bundle to check.
	 * @returns Whether the bundle's fibers are listed.
	 */
	function isExpanded(bundleNumber: number): boolean {
		return toggledBundles.has(bundleNumber) !== (bundles.length === 1);
	}

	/**
	 * @param bundleNumber - The bundle to expand or collapse.
	 */
	function toggleBundle(bundleNumber: number) {
		if (!toggledBundles.delete(bundleNumber)) toggledBundles.add(bundleNumber);
	}

	/**
	 * @param fiber - The fiber to trace.
	 */
	function traceFiber(fiber: Fiber) {
		goto(resolve(search.tracePath('fiber', fiber.uuid)));
	}
</script>

{#if bundles.length > 0}
	<div class="space-y-2">
		{#each bundles as bundle (bundle.bundleNumber)}
			{@const expanded = isExpanded(bundle.bundleNumber)}
			<div class="rounded-lg border border-surface-200-800">
				<button
					type="button"
					onclick={() => toggleBundle(bundle.bundleNumber)}
					aria-expanded={expanded}
					class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-50-950"
				>
					<IconChevronDown
						size={18}
						class="text-surface-500-400 transition-transform {expanded ? '' : '-rotate-90'}"
					/>
					<span
						class="h-4 w-4 rounded-full border border-surface-300"
						style:background-color={fiberColorHex(colors, bundle.bundleColor)}
					></span>
					<span class="font-medium text-surface-900-100">
						{m.form_bundle()}
						{bundle.bundleNumber}
					</span>
					<span class="text-sm text-surface-600-400">
						({bundle.fibers.length}
						{m.form_fibers()})
					</span>
				</button>

				{#if expanded}
					<div class="border-t border-surface-200-800" transition:slide={{ duration: 150 }}>
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-surface-100-900 text-left text-xs text-surface-600-400">
									<th class="px-4 py-2 font-medium">#</th>
									<th class="px-4 py-2 font-medium">{m.form_color()}</th>
									<th class="px-4 py-2 font-medium"></th>
								</tr>
							</thead>
							<tbody>
								{#each bundle.fibers as fiber (fiber.uuid)}
									<tr
										class="cursor-pointer border-b border-surface-100-900 last:border-b-0 hover:bg-surface-50-950"
										onclick={() => traceFiber(fiber)}
									>
										<td class="px-4 py-2 font-mono text-surface-900-100">
											{fiber.fiber_number_in_bundle}
										</td>
										<td class="px-4 py-2">
											<div class="flex items-center gap-2">
												<span
													class="h-3.5 w-3.5 rounded-full border border-surface-300"
													style:background-color={fiberColorHex(colors, fiber.fiber_color ?? '')}
												></span>
												<span class="text-surface-700-300">{fiber.fiber_color || '-'}</span>
											</div>
										</td>
										<td class="px-4 py-2 text-right">
											<button
												type="button"
												class="rounded bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-500 hover:bg-primary-500/20"
											>
												{m.action_trace()}
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<div class="py-8 text-center text-sm text-surface-500-400">
		{m.trace_no_fibers_in_cable()}
	</div>
{/if}
