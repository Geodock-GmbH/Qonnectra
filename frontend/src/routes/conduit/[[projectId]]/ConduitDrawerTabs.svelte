<script>
	import { onMount } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	import { ConduitDataManager } from '$lib/classes/ConduitDataManager.svelte.js';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import MicroductsDisplayTable from '$lib/components/MicroductsDisplayTable.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	import ConduitAttributeCard from './ConduitAttributeCard.svelte';

	const conduitDataManager = new ConduitDataManager();

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
		{ value: 'status', label: m.form_status() },
		{ value: 'files', label: m.form_attachments() }
	];

	const featureId = $derived(data?.uuid);

	/** @type {any} */
	let fileExplorer = $state(null);

	function handleUploadComplete() {
		if (fileExplorer) {
			fileExplorer.refresh();
		}
	}

	onMount(() => {
		return () => conduitDataManager.cleanup();
	});

	let lastFetchedFeatureId = $state(null);

	/**
	 * Fetch data when status tab becomes active
	 * @param {string} newValue - The new tab value
	 */
	function handleTabChange(newValue) {
		if (newValue === 'status' && featureId) {
			if (featureId !== lastFetchedFeatureId) {
				lastFetchedFeatureId = featureId;
				conduitDataManager.fetchMicroducts(featureId);
			}
			conduitDataManager.fetchStatusOptions();
		}
	}

	/**
	 * @param {{ uuid: string }} microduct
	 * @param {number|null} statusId
	 */
	async function handleStatusChange(microduct, statusId) {
		const updated = await conduitDataManager.updateMicroductStatus(microduct.uuid, statusId);

		if (updated) {
			conduitDataManager.updateMicroductInState(featureId, updated);
			globalToaster.success({
				title: m.message_status_updated(),
				duration: 3000
			});
		} else {
			globalToaster.error({
				title: m.message_status_update_failed(),
				duration: 5000
			});
		}
	}
</script>

<Tabs tabs={tabItems} bind:value={group} onValueChange={handleTabChange}>
	{#if group === 'attributes'}
		<ConduitAttributeCard {...data} {onConduitUpdate} {onConduitDelete} />
	{/if}

	{#if group === 'status'}
		<div class="p-4">
			<MicroductsDisplayTable
				microducts={conduitDataManager.getMicroductsForPipe(featureId)}
				loading={conduitDataManager.isLoadingMicroducts(featureId)}
				error={conduitDataManager.getMicroductsError(featureId)}
				showStatus={true}
				editableStatus={true}
				statusOptions={conduitDataManager.statusOptions}
				onStatusChange={handleStatusChange}
			/>
		</div>
	{/if}

	{#if group === 'files'}
		<div class="space-y-4">
			<FileUpload featureType="conduit" {featureId} onUploadComplete={handleUploadComplete} />
			<FileExplorer bind:this={fileExplorer} featureType="conduit" {featureId} />
		</div>
	{/if}
</Tabs>
