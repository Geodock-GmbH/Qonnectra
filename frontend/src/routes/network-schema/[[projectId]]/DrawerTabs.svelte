<script>
	// Skeleton
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	// Svelte
	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

	let { data, type, onLabelUpdate } = $props();

	let group = $state('attributes');
	console.log(type);
</script>

<Tabs value={group} onValueChange={(e) => (group = e.value)}>
	{#snippet list()}
		<Tabs.Control value="attributes">{m.common_attributes()}</Tabs.Control>
	{/snippet}
	{#snippet content()}
		<Tabs.Panel value="attributes">
			{#if type === 'edge'}
				<CableDiagramEdgeAttributeCard {...data} {onLabelUpdate} />
			{:else if type === 'node'}
				<CableDiagramNodeAttributeCard {...data} {onLabelUpdate} />
			{/if}
		</Tabs.Panel>
	{/snippet}
</Tabs>
