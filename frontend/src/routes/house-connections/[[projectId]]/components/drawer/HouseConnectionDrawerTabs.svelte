<script lang="ts">
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import HouseConnectionAccordion from './HouseConnectionAccordion.svelte';

	interface Props {
		/** UUID of the selected trench */
		featureId?: string;
	}

	let { featureId = '' }: Props = $props();

	let activeTab = $state('details');

	const tabItems = $derived([{ value: 'details', label: m.common_overview() }]);
</script>

<Tabs tabs={tabItems} bind:value={activeTab}>
	<SkeletonTabs.Content value="details">
		{#if featureId}
			{#key featureId}
				<QueryBoundary>
					<HouseConnectionAccordion {featureId} />
				</QueryBoundary>
			{/key}
		{/if}
	</SkeletonTabs.Content>
</Tabs>
