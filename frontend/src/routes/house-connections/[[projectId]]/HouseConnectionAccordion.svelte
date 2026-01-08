<script>
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconMinus, IconPlus, IconRefresh } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { ConduitDataManager } from '$lib/classes/ConduitDataManager.svelte.js';
	import { drawerStore } from '$lib/stores/drawer';
	import { tooltip } from '$lib/utils/tooltip.js';

	import MicroductsTable from './MicroductsTable.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {(conduitId: string, trenchUuids: string[], isOpen: boolean) => void} [onHighlightChange] - Callback for highlight changes
	 */

	/** @type {Props} */
	let { onHighlightChange } = $props();

	let featureId = $derived($drawerStore.props?.featureId);

	const dataManager = new ConduitDataManager();

	// Track which accordion items are currently open
	let openItems = $state([]);

	/**
	 * Handle accordion value change
	 * Detects which items were opened/closed and triggers highlight changes
	 * @param {{ value: string[] }} details - Accordion change details
	 */
	async function handleAccordionChange(details) {
		const newOpenItems = details.value;
		const previousOpenItems = openItems;

		// Find newly opened items
		const opened = newOpenItems.filter((id) => !previousOpenItems.includes(id));

		// Find newly closed items
		const closed = previousOpenItems.filter((id) => !newOpenItems.includes(id));

		// Update state
		openItems = newOpenItems;

		// Handle opened items - fetch trench UUIDs and notify parent
		for (const itemId of opened) {
			const item = dataManager.pipesInTrench.find((p) => p.id === itemId);
			if (item?.pipeUuid) {
				// Fetch microducts (existing behavior)
				dataManager.fetchMicroducts(item.pipeUuid);

				// Fetch trench UUIDs for highlighting
				const trenchUuids = await dataManager.fetchTrenchUuidsForConduit(item.pipeUuid);
				onHighlightChange?.(item.pipeUuid, trenchUuids, true);
			}
		}

		// Handle closed items - notify parent to remove highlighting
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
			// Reset open items when feature changes
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
		<p>{m.message_no_conduits_found()}</p>
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
								dataManager.refreshMicroducts(item.pipeUuid);
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
						<MicroductsTable
							microducts={dataManager.getMicroductsForPipe(item.pipeUuid)}
							loading={dataManager.isLoadingMicroducts(item.pipeUuid)}
							error={dataManager.getMicroductsError(item.pipeUuid)}
							onMicroductUpdate={(updatedMicroduct) =>
								dataManager.updateMicroductInState(item.pipeUuid, updatedMicroduct)}
						/>
					</div>
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
