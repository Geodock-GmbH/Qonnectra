<script>
	import { m } from '$lib/paraglide/messages';

	import FeatureAttributeCard from '$lib/components/FeatureAttributeCard.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Object} featureData - Feature properties from MVT
	 * @property {string} featureType - Type of feature ('trench', 'address', 'node')
	 * @property {string} featureId - UUID of the feature
	 * @property {Object} alias - Field name alias mapping (English -> Localized)
	 */

	/** @type {Props} */
	let { featureData = {}, featureType = 'trench', featureId = '', alias = {} } = $props();

	let activeTab = $state('attributes');

	const tabItems = $derived([
		{ value: 'attributes', label: m.common_attributes() },
		{ value: 'files', label: m.form_attachments() }
	]);

	let fileExplorer = $state(null);

	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}
</script>

<Tabs tabs={tabItems} bind:value={activeTab}>
	{#if activeTab === 'attributes'}
		<FeatureAttributeCard properties={featureData} {featureType} {alias} />
	{/if}

	{#if activeTab === 'files'}
		<div class="space-y-4">
			<FileUpload
				{featureType}
				{featureId}
				onUploadComplete={handleUploadComplete}
			/>
			<FileExplorer
				bind:this={fileExplorer}
				{featureType}
				{featureId}
			/>
		</div>
	{/if}
</Tabs>
