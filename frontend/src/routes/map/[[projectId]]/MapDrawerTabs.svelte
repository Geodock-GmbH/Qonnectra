<script>
	// Components
	import Tabs from '$lib/components/Tabs.svelte';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let { data, type, onLabelUpdate, onEdgeDelete } = $props();

	let group = $state('attributes');

	const tabItems = $derived(() => {
		const baseTabs = [{ value: 'attributes', label: m.common_attributes() }];
		return baseTabs;
	});
</script>

<Tabs tabs={tabItems()} bind:value={group}>
	<SkeletonTabs.Content value="attributes"></SkeletonTabs.Content>
</Tabs>
