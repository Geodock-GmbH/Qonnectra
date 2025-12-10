<script>
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { IconMinus, IconPlus } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { ConduitDataManager } from '$lib/classes/ConduitDataManager.svelte.js';
	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} featureId - UUID of the trench feature
	 */

	/** @type {Props} */
	let { featureId = '' } = $props();

	const dataManager = new ConduitDataManager();

	$effect(() => {
		if (featureId) {
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
	<Accordion>
		{#each dataManager.pipesInTrench as item (item.id)}
			<Accordion.Item value={item.id}>
				<Accordion.ItemTrigger
					class="flex justify-between items-center"
					onclick={() => dataManager.fetchMicroducts(item.pipeUuid)}
				>
					{item.title}
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
						/>
					</div>
				</Accordion.ItemContent>
				<hr class="hr" />
			</Accordion.Item>
		{/each}
	</Accordion>
{/if}
