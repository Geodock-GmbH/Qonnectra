<script lang="ts">
	import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
	import { getContext } from 'svelte';
	import { deserialize } from '$app/forms';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconHighlight, IconMinus, IconPlus } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { ConduitDataManager } from '$lib/classes/ConduitDataManager.svelte';
	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { tooltip } from '$lib/utils/tooltip';

	interface Props {
		/** UUID of the trench feature */
		featureId?: string;
	}

	let { featureId = '' }: Props = $props();

	const dataManager = new ConduitDataManager();

	const { selectionManager } = getContext<{ selectionManager: MapSelectionManager }>('mapManagers');

	let highlightLoading = $state<Record<string, boolean>>({});

	$effect(() => {
		if (featureId) {
			dataManager.fetchPipesInTrench(featureId);
		}
	});

	/**
	 * Highlight all trenches containing the specified conduit on the map
	 * @param event - Click event
	 * @param pipeUuid - UUID of the conduit
	 */
	async function handleHighlightTrenches(event: Event, pipeUuid: string) {
		event.stopPropagation();

		if (!pipeUuid || highlightLoading[pipeUuid]) return;

		highlightLoading = { ...highlightLoading, [pipeUuid]: true };

		try {
			const formData = new FormData();
			formData.append('uuid', pipeUuid);

			const response = await fetch('?/getTrenchesForConduit', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data?.trench_uuids) {
				selectionManager.selectMultipleFeatures(result.data.trench_uuids as (string | number)[]);
			}
		} catch (err) {
			console.error('Error highlighting trenches:', err);
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
			highlightLoading = { ...highlightLoading, [pipeUuid]: false };
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
{:else if dataManager.pipesInTrench.length === 0}
	<div class="border rounded-lg p-4">
		<p>{m.message_no_conduits_found()}</p>
	</div>
{:else}
	<Accordion multiple>
		{#each dataManager.pipesInTrench as item (item.id)}
			<Accordion.Item value={item.id}>
				<Accordion.ItemTrigger
					class="flex justify-between items-center"
					onclick={() => dataManager.fetchMicroducts(item.pipeUuid)}
				>
					<span class="flex-1 text-left">{item.title}</span>
					<button
						type="button"
						class="btn btn-sm btn-icon preset-filled-secondary-500 p-1 mr-2"
						aria-label={m.action_highlight_trenches()}
						{@attach tooltip(m.action_highlight_trenches())}
						onclick={(e) => handleHighlightTrenches(e, item.pipeUuid)}
						disabled={highlightLoading[item.pipeUuid]}
					>
						{#if highlightLoading[item.pipeUuid]}
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
						<MicroductsDisplayTable
							microducts={dataManager.getMicroductsForPipe(item.pipeUuid)}
							loading={dataManager.isLoadingMicroducts(item.pipeUuid)}
							error={dataManager.getMicroductsError(item.pipeUuid)}
							showStatus={true}
						/>
					</div>
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
