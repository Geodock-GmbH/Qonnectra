<script>
	// Components
	import Tabs from '$lib/components/Tabs.svelte';
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	// Svelte
	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

	let { data, type, onLabelUpdate, onEdgeDelete } = $props();

	let group = $state('attributes');

	const tabItems = $derived(() => {
		const baseTabs = [{ value: 'attributes', label: m.common_attributes() }];
		if (type === 'edge') {
			baseTabs.push({ value: 'handles', label: m.form_handles() });
		}
		return baseTabs;
	});
</script>

<Tabs tabs={tabItems()} bind:value={group}>
	<SkeletonTabs.Content value="attributes">
		{#if type === 'edge'}
			<CableDiagramEdgeAttributeCard {...data} {onLabelUpdate} {onEdgeDelete} />
		{:else if type === 'node'}
			<CableDiagramNodeAttributeCard {...data} {onLabelUpdate} />
		{/if}
	</SkeletonTabs.Content>
	<SkeletonTabs.Content value="handles">
		<CableDiagramEdgeHandleConfig {...data} />
	</SkeletonTabs.Content>
</Tabs>
