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
	<Tabs.List>
		<Tabs.Trigger class="flex-1" value="attributes">{m.common_attributes()}</Tabs.Trigger>
		{#if type === 'edge'}
			<Tabs.Trigger class="flex-1" value="handles">{m.form_handles()}</Tabs.Trigger>
		{/if}
		<Tabs.Indicator />
	</Tabs.List>
	<Tabs.Content value="attributes">
		{#if type === 'edge'}
			<CableDiagramEdgeAttributeCard {...data} {onLabelUpdate} {onEdgeDelete} />
		{:else if type === 'node'}
			<CableDiagramNodeAttributeCard {...data} {onLabelUpdate} />
		{/if}
	</Tabs.Content>
	<Tabs.Content value="handles">
		<CableDiagramEdgeHandleConfig {...data} />
	</Tabs.Content>
</Tabs>
