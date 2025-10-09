<script>
	// Skeleton
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	// Svelte
	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

	let { data, type, onLabelUpdate, onEdgeDelete } = $props();

	let group = $state('attributes');
</script>

<Tabs value={group} onValueChange={(e) => (group = e.value)}>
	{#snippet list()}
		<Tabs.Control value="attributes">{m.common_attributes()}</Tabs.Control>
		{#if type === 'edge'}
			<Tabs.Control value="handles">{m.form_handles()}</Tabs.Control>
		{/if}
	{/snippet}
	{#snippet content()}
		<Tabs.Panel value="attributes">
			{#if type === 'edge'}
				<CableDiagramEdgeAttributeCard {...data} {onLabelUpdate} {onEdgeDelete} />
			{:else if type === 'node'}
				<CableDiagramNodeAttributeCard {...data} {onLabelUpdate} />
			{/if}
		</Tabs.Panel>
		{#if type === 'edge'}
			<Tabs.Panel value="handles">
				<CableDiagramEdgeHandleConfig {...data} />
			</Tabs.Panel>
		{/if}
	{/snippet}
</Tabs>
