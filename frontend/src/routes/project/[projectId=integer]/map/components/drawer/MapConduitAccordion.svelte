<script lang="ts">
	import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
	import { getContext } from 'svelte';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconHighlight, IconMinus, IconPlus } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import { getConduitTrenches } from '$lib/remote/map/feature-search.remote';
	import { trenchConduitTitle } from '$lib/remote/map/trench-data';
	import { getConduitsInTrench } from '$lib/remote/map/trenches.remote';

	import MapConduitMicroducts from './MapConduitMicroducts.svelte';

	interface Props {
		/** UUID of the trench feature */
		featureId: string;
	}

	let { featureId }: Props = $props();

	const { selectionManager } = getContext<{ selectionManager: MapSelectionManager }>('mapManagers');

	const conduits = $derived(await getConduitsInTrench(featureId));

	let openItems = $state<string[]>([]);
	let highlightLoading = $state<Record<string, boolean>>({});

	/**
	 * Highlight all trenches containing the specified conduit on the map
	 * @param event - Click event
	 * @param conduitUuid - UUID of the conduit
	 */
	async function handleHighlightTrenches(event: Event, conduitUuid: string | undefined) {
		event.stopPropagation();

		if (!conduitUuid || highlightLoading[conduitUuid]) return;

		highlightLoading[conduitUuid] = true;

		try {
			const { trenchUuids } = await getConduitTrenches(conduitUuid);
			selectionManager.selectMultipleFeatures(trenchUuids);
		} catch (err) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error highlighting trenches',
				extraData: {
					from: 'MapConduitAccordion.handleHighlightTrenches',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_highlighting_trenches()
			});
		} finally {
			highlightLoading[conduitUuid] = false;
		}
	}
</script>

{#if conduits.length === 0}
	<div class="border rounded-lg p-4">
		<p>{m.message_no_conduits_found()}</p>
	</div>
{:else}
	<Accordion multiple value={openItems} onValueChange={(details) => (openItems = details.value)}>
		{#each conduits as item (item.uuid)}
			{@const conduitUuid = item.conduit?.uuid}
			<Accordion.Item value={item.uuid}>
				<Accordion.ItemTrigger class="flex justify-between items-center">
					<span class="flex-1 text-left">{trenchConduitTitle(item)}</span>
					<button
						type="button"
						class="btn btn-sm btn-icon preset-filled-secondary-500 p-1 mr-2"
						aria-label={m.action_highlight_trenches()}
						{@attach tooltip(m.action_highlight_trenches())}
						onclick={(e) => handleHighlightTrenches(e, conduitUuid)}
						disabled={!conduitUuid || highlightLoading[conduitUuid]}
					>
						{#if conduitUuid && highlightLoading[conduitUuid]}
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
					{#if conduitUuid && openItems.includes(item.uuid)}
						<QueryBoundary>
							<MapConduitMicroducts {conduitUuid} />
						</QueryBoundary>
					{/if}
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
