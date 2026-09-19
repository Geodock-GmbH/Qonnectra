<script lang="ts">
	import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
	import { getContext } from 'svelte';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconHighlight, IconMinus, IconPlus, IconRoute } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import { traceFrom } from '$lib/utils/traceUtils';
	import { trenchCableTitle } from '$lib/remote/map/trench-data';
	import { getCablesInTrench } from '$lib/remote/map/trenches.remote';
	import { getLinkedTrenchesForCable } from '$lib/remote/network-schema/micropipes.remote';

	import MapCableFibers from './MapCableFibers.svelte';

	interface Props {
		/** UUID of the trench feature */
		featureId: string;
	}

	let { featureId }: Props = $props();

	const { selectionManager } = getContext<{ selectionManager: MapSelectionManager }>('mapManagers');

	const cables = $derived(await getCablesInTrench(featureId));

	let openItems = $state<string[]>([]);
	let highlightLoading = $state<Record<string, boolean>>({});

	/**
	 * Highlight all trenches containing the specified cable on the map
	 * @param event - Click event
	 * @param cableUuid - UUID of the cable
	 */
	async function handleHighlightTrenches(event: Event, cableUuid: string) {
		event.stopPropagation();

		if (highlightLoading[cableUuid]) return;

		highlightLoading[cableUuid] = true;

		try {
			const trenchUuids = await getLinkedTrenchesForCable(cableUuid);
			if (trenchUuids.length > 0) {
				selectionManager.selectMultipleFeatures(trenchUuids);
			}
		} catch (err) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error highlighting trenches for cable',
				extraData: {
					from: 'MapCableAccordion.handleHighlightTrenches',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				description: m.message_error_highlighting_trenches()
			});
		} finally {
			highlightLoading[cableUuid] = false;
		}
	}
</script>

{#if cables.length === 0}
	<div class="border rounded-lg p-4">
		<p>{m.message_no_cables_in_trench()}</p>
	</div>
{:else}
	<Accordion multiple value={openItems} onValueChange={(details) => (openItems = details.value)}>
		{#each cables as cable (cable.uuid)}
			<Accordion.Item value={cable.uuid}>
				<Accordion.ItemTrigger class="flex justify-between items-center">
					<div class="flex-1 text-left">
						<span class="font-medium">{trenchCableTitle(cable)}</span>
						<span class="text-surface-500 text-sm ml-2">
							{cable.fiber_count ?? 0}
							{m.form_fibers()}
						</span>
					</div>
					<button
						type="button"
						class="btn btn-sm btn-icon preset-filled-secondary-500 p-1 mr-2"
						aria-label={m.action_trace()}
						{@attach tooltip(m.action_trace())}
						onclick={(e) => {
							e.stopPropagation();
							traceFrom('cable', cable.uuid);
						}}
					>
						<IconRoute class="size-4" />
					</button>
					<button
						type="button"
						class="btn btn-sm btn-icon preset-filled-secondary-500 p-1 mr-2"
						aria-label={m.action_highlight_trenches()}
						{@attach tooltip(m.action_highlight_trenches())}
						onclick={(e) => handleHighlightTrenches(e, cable.uuid)}
						disabled={highlightLoading[cable.uuid]}
					>
						{#if highlightLoading[cable.uuid]}
							<span
								class="size-4 animate-spin border-2 border-current border-t-transparent rounded-full"
							></span>
						{:else}
							<IconHighlight class="size-4" />
						{/if}
					</button>
					<Accordion.ItemIndicator class="group">
						<IconMinus class="size-4 group-data-[state=open]:block hidden" />
						<IconPlus class="size-4 group-data-[state=open]:hidden block" />
					</Accordion.ItemIndicator>
				</Accordion.ItemTrigger>
				<Accordion.ItemContent>
					{#if openItems.includes(cable.uuid)}
						<QueryBoundary>
							<MapCableFibers cableUuid={cable.uuid} />
						</QueryBoundary>
					{/if}
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
