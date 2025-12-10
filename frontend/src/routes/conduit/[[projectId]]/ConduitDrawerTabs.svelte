<script>
	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	import ConduitAttributeCard from './ConduitAttributeCard.svelte';

	let allProps = $props();

	let group = $state('attributes');

	// Extract conduit data and callbacks from props
	const data = $derived.by(() => {
		const { onConduitUpdate, onConduitDelete, ...rest } = allProps;
		return rest;
	});

	const onConduitUpdate = $derived(allProps.onConduitUpdate);
	const onConduitDelete = $derived(allProps.onConduitDelete);

	const tabItems = [
		{ value: 'attributes', label: m.common_attributes() },
		{ value: 'files', label: m.form_attachments() }
	];

	const featureId = $derived(data?.uuid);

	let fileExplorer = $state(null);

	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}
</script>

<Tabs tabs={tabItems} bind:value={group}>
	{#if group === 'attributes'}
		<ConduitAttributeCard {...data} {onConduitUpdate} {onConduitDelete} />
	{/if}

	{#if group === 'files'}
		<div class="space-y-4">
			<FileUpload featureType="conduit" {featureId} onUploadComplete={handleUploadComplete} />
			<FileExplorer bind:this={fileExplorer} featureType="conduit" {featureId} />
		</div>
	{/if}
</Tabs>
