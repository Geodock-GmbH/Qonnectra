<script lang="ts">
	import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
	import { getContext, untrack } from 'svelte';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconHighlight, IconMinus, IconPlus, IconRoute } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { CableTrenchDataManager } from '$lib/classes/CableTrenchDataManager.svelte';
	import FibersDisplayTable from '$lib/components/FibersDisplayTable.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';

	import { traceFrom } from '../../trace/traceUtils';

	interface Props {
		/** UUID of the trench feature */
		featureId?: string;
	}

	let { featureId = '' }: Props = $props();

	const dataManager = new CableTrenchDataManager();

	const { selectionManager } = getContext<{ selectionManager: MapSelectionManager }>('mapManagers');

	let highlightLoading = $state<Record<string, boolean>>({});

	$effect(() => {
		if (featureId) {
			untrack(() => {
				dataManager.fetchCablesInTrench(featureId);
				dataManager.fetchFiberColors();
			});
		}
	});

	/**
	 * Highlight all trenches containing the specified cable on the map
	 * @param event - Click event
	 * @param cableUuid - UUID of the cable
	 */
	async function handleHighlightTrenches(event: Event, cableUuid: string) {
		event.stopPropagation();

		if (!cableUuid || highlightLoading[cableUuid]) return;

		highlightLoading = { ...highlightLoading, [cableUuid]: true };

		try {
			const response = await fetch(`${PUBLIC_API_URL}cables/${cableUuid}/linked-trenches/`, {
				credentials: 'include'
			});

			if (response.ok) {
				const data = await response.json();
				if (data.trench_uuids && data.trench_uuids.length > 0) {
					selectionManager.selectMultipleFeatures(data.trench_uuids);
				}
			} else {
				globalToaster.error({
					description: m.message_error_highlighting_trenches()
				});
			}
		} catch (err) {
			console.error('Error highlighting trenches for cable:', err);
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
			highlightLoading = { ...highlightLoading, [cableUuid]: false };
		}
	}
</script>

{#if dataManager.loading}
	<div class="placeholder animate-pulse min-h-6">
		<div class="placeholder animate-pulse"></div>
	</div>
{:else if dataManager.error}
	<div class="p-4 text-red-700 bg-red-100 border border-red-400 rounded">
		<p>{dataManager.error}</p>
	</div>
{:else if dataManager.cablesInTrench.length === 0}
	<div class="border rounded-lg p-4">
		<p>{m.message_no_cables_in_trench()}</p>
	</div>
{:else}
	<Accordion multiple>
		{#each dataManager.cablesInTrench as item (item.id)}
			<Accordion.Item value={item.id}>
				<Accordion.ItemTrigger
					class="flex justify-between items-center"
					onclick={() => dataManager.fetchFibersForCable(item.cableUuid)}
				>
					<div class="flex-1 text-left">
						<span class="font-medium">{item.title}</span>
						<span class="text-surface-500 text-sm ml-2">
							{item.fiberCount}
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
							traceFrom('cable', item.cableUuid);
						}}
					>
						<IconRoute class="size-4" />
					</button>
					<button
						type="button"
						class="btn btn-sm btn-icon preset-filled-secondary-500 p-1 mr-2"
						aria-label={m.action_highlight_trenches()}
						{@attach tooltip(m.action_highlight_trenches())}
						onclick={(e) => handleHighlightTrenches(e, item.cableUuid)}
						disabled={highlightLoading[item.cableUuid]}
					>
						{#if highlightLoading[item.cableUuid]}
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
					<div class="space-y-2">
						<FibersDisplayTable
							fibers={dataManager.getFibersForCable(item.cableUuid)}
							loading={dataManager.isLoadingFibers(item.cableUuid)}
							error={dataManager.getFibersError(item.cableUuid)}
							getColorHex={(color) => dataManager.getColorHex(color)}
							getColorName={(color) => dataManager.getColorName(color)}
							onTraceFiber={(fiberUuid) => traceFrom('fiber', fiberUuid)}
						/>
					</div>
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
