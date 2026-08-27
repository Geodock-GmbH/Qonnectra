<script lang="ts">
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconMinus, IconPlus, IconRefresh } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { ConduitDataManager } from '$lib/classes/ConduitDataManager.svelte';
	import { drawerStore } from '$lib/stores/drawer';
	import { tooltip } from '$lib/utils/tooltip';

	import MicroductsTable from './MicroductsTable.svelte';

	interface Props {
		/** Callback for highlight changes */
		onHighlightChange?: (conduitId: string, trenchUuids: string[], isOpen: boolean) => void;
	}

	let { onHighlightChange }: Props = $props();

	let featureId = $derived($drawerStore.props?.featureId);

	const dataManager = new ConduitDataManager();

	let openItems = $state<string[]>([]);

	/**
	 * Handles accordion open/close changes, fetching microducts for newly opened items
	 * and notifying the parent about trench highlight changes.
	 * @param details - Accordion change event with currently open item IDs.
	 */
	async function handleAccordionChange(details: { value: string[] }) {
		const newOpenItems = details.value;
		const previousOpenItems = openItems;

		const opened = newOpenItems.filter((id) => !previousOpenItems.includes(id));
		const closed = previousOpenItems.filter((id) => !newOpenItems.includes(id));

		openItems = newOpenItems;

		for (const itemId of opened) {
			const item = dataManager.pipesInTrench.find((p) => p.id === itemId);
			if (item?.pipeUuid) {
				dataManager.fetchMicroducts(item.pipeUuid);

				const trenchUuids = await dataManager.fetchTrenchUuidsForConduit(item.pipeUuid);
				onHighlightChange?.(item.pipeUuid, trenchUuids, true);
			}
		}

		for (const itemId of closed) {
			const item = dataManager.pipesInTrench.find((p) => p.id === itemId);
			if (item?.pipeUuid) {
				const trenchUuids = dataManager.getTrenchUuidsForConduit(item.pipeUuid);
				onHighlightChange?.(item.pipeUuid, trenchUuids, false);
			}
		}
	}

	$effect(() => {
		if (featureId) {
			openItems = [];
			dataManager.fetchPipesInTrench(featureId);
		}
	});
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
		<p>{m.message_no_conduits_found_in_trench()}</p>
	</div>
{:else}
	<Accordion multiple value={openItems} onValueChange={handleAccordionChange}>
		{#each dataManager.pipesInTrench as item (item.id)}
			<Accordion.Item value={item.id}>
				<Accordion.ItemTrigger class="flex justify-between items-center">
					{item.title}
					<div class="flex items-center gap-2">
						<button
							class="btn btn-sm btn-icon preset-filled-secondary-500"
							onclick={(e) => {
								e.stopPropagation();
								if (item.pipeUuid) dataManager.refreshMicroducts(item.pipeUuid);
							}}
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
					<div class="space-y-2">
						{#if item.pipeUuid}
							<MicroductsTable
								microducts={dataManager.getMicroductsForPipe(item.pipeUuid)}
								loading={dataManager.isLoadingMicroducts(item.pipeUuid)}
								error={dataManager.getMicroductsError(item.pipeUuid)}
								onMicroductUpdate={(updatedMicroduct: any) =>
									dataManager.updateMicroductInState(item.pipeUuid as string, updatedMicroduct)}
							/>
						{/if}
					</div>
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
