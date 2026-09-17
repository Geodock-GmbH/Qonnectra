<script lang="ts">
	import { page } from '$app/state';
	import { IconFolder } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import FiberConnectionsCard from './components/FiberConnectionsCard.svelte';
	import ResidentialUnitForm from './components/ResidentialUnitForm.svelte';

	const projectId = $derived(page.params.projectId ?? '');
	const addressUuid = $derived(page.params.uuid ?? '');
	const unitUuid = $derived(page.params.unitUuid ?? '');

	let fileExplorer = $state<ReturnType<typeof FileExplorer> | null>(null);

	function handleUploadComplete() {
		fileExplorer?.refresh();
	}
</script>

<svelte:head>
	<title>{m.section_residential_units({ count: 1 })}</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
	{#key unitUuid}
		<QueryBoundary>
			<ResidentialUnitForm {unitUuid} {addressUuid} {projectId} />
		</QueryBoundary>

		<QueryBoundary>
			<FiberConnectionsCard {unitUuid} />
		</QueryBoundary>

		<div class="card p-4 sm:p-6 space-y-4">
			<div class="flex items-center gap-3">
				<IconFolder class="size-5 text-success-500" />
				<h2 class="text-lg font-semibold">{m.form_attachments()}</h2>
			</div>

			<FileUpload
				featureType="residentialunit"
				featureId={unitUuid}
				onUploadComplete={handleUploadComplete}
			/>
			<FileExplorer bind:this={fileExplorer} featureType="residentialunit" featureId={unitUuid} />
		</div>
	{/key}
</div>
