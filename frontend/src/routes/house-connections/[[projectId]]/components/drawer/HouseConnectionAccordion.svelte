<script lang="ts">
	import type { TrenchConduit } from '$lib/remote/map/trench-data';
	import { onMount } from 'svelte';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconMinus, IconPlus, IconRefresh } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';
	import { getMicroducts } from '$lib/remote/conduit/microducts.remote';
	import { getConduitTrenches } from '$lib/remote/map/feature-search.remote';
	import { trenchConduitTitle } from '$lib/remote/map/trench-data';
	import { getConduitsInTrench } from '$lib/remote/map/trenches.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import HouseConnectionMicroducts from './HouseConnectionMicroducts.svelte';
	import { getHouseConnectionInteraction } from '../houseConnectionContext';

	interface Props {
		/** UUID of the selected trench */
		featureId: string;
	}

	let { featureId }: Props = $props();

	const { trenchHighlights } = getHouseConnectionInteraction();

	const conduits = $derived(await getConduitsInTrench(featureId));

	let openItems = $state<string[]>([]);

	/**
	 * Highlights every trench the conduit runs through, unless the item was
	 * closed again while the trenches were loading.
	 * @param item - The opened trench-conduit connection.
	 */
	async function highlightTrenches(item: TrenchConduit) {
		const conduitUuid = item.conduit?.uuid;
		if (!conduitUuid) return;

		try {
			const { trenchUuids } = await getConduitTrenches(conduitUuid);
			if (openItems.includes(item.uuid)) trenchHighlights.show(conduitUuid, trenchUuids);
		} catch (err) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error highlighting trenches',
				extraData: {
					from: 'HouseConnectionAccordion.highlightTrenches',
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_highlighting_trenches()
			});
		}
	}

	/**
	 * Tracks the open conduits and keeps the map highlight in step with them.
	 * @param details - Accordion change event with the currently open item ids.
	 */
	function handleAccordionChange(details: { value: string[] }) {
		const opened = conduits.filter(
			(item) => details.value.includes(item.uuid) && !openItems.includes(item.uuid)
		);
		const closed = conduits.filter(
			(item) => openItems.includes(item.uuid) && !details.value.includes(item.uuid)
		);

		openItems = details.value;

		for (const item of closed) {
			if (item.conduit?.uuid) trenchHighlights.hide(item.conduit.uuid);
		}
		for (const item of opened) {
			void highlightTrenches(item);
		}
	}

	/**
	 * Reloads the microducts of a conduit.
	 * @param event - Click event
	 * @param conduitUuid - UUID of the conduit
	 */
	async function handleRefresh(event: Event, conduitUuid: string) {
		event.stopPropagation();

		try {
			await getMicroducts(conduitUuid).refresh();
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_error_loading_data()
			});
		}
	}

	onMount(() => () => trenchHighlights.clear());
</script>

{#if conduits.length === 0}
	<div class="border rounded-lg p-4">
		<p>{m.message_no_conduits_found_in_trench()}</p>
	</div>
{:else}
	<Accordion multiple value={openItems} onValueChange={handleAccordionChange}>
		{#each conduits as item (item.uuid)}
			{@const conduitUuid = item.conduit?.uuid}
			{@const isOpen = openItems.includes(item.uuid)}
			<Accordion.Item value={item.uuid}>
				<Accordion.ItemTrigger class="flex justify-between items-center">
					{trenchConduitTitle(item)}
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="btn btn-sm btn-icon preset-filled-secondary-500"
							onclick={(e) => conduitUuid && handleRefresh(e, conduitUuid)}
							disabled={!conduitUuid}
							aria-label={m.tooltip_refresh_microducts()}
							{@attach tooltip(m.tooltip_refresh_microducts(), { position: 'bottom', delay: 1000 })}
						>
							<IconRefresh class="size-4" />
						</button>
						<Accordion.ItemIndicator class="group">
							<IconMinus class="size-4 group-data-[state=open]:block hidden" />
							<IconPlus class="size-4 group-data-[state=open]:hidden block" />
						</Accordion.ItemIndicator>
					</div>
				</Accordion.ItemTrigger>
				<Accordion.ItemContent>
					{#if conduitUuid && isOpen}
						<QueryBoundary>
							<HouseConnectionMicroducts {conduitUuid} />
						</QueryBoundary>
					{/if}
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
