<script>
	import { Tabs as SkeletonTabs } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import FileUpload from '$lib/components/FileUpload.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';
	import CableDiagramEdgeHandleConfig from './CableDiagramEdgeHandleConfig.svelte';
	import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

	let allProps = $props();

	let group = $state('attributes');

	const data = $derived.by(() => {
		const { type, onLabelUpdate, onEdgeDelete, ...rest } = allProps;
		return rest;
	});

	const type = $derived(allProps.type);
	const onLabelUpdate = $derived(allProps.onLabelUpdate);
	const onEdgeDelete = $derived(allProps.onEdgeDelete);

	const tabItems = $derived.by(() => {
		const baseTabs = [{ value: 'attributes', label: m.common_attributes() }];
		if (type === 'edge') {
			baseTabs.push({ value: 'handles', label: m.form_handles() });
		}
		baseTabs.push({ value: 'files', label: m.form_attachments() });
		return baseTabs;
	});

	const featureId = $derived(data?.uuid || data?.id);
</script>

<Tabs tabs={tabItems} bind:value={group}>
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
	<SkeletonTabs.Content value="files">
		<FileUpload featureType={type === 'edge' ? 'cable' : 'node'} {featureId} />
	</SkeletonTabs.Content>
</Tabs>
