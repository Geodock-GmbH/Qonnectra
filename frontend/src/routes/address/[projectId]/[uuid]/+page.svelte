<script lang="ts">
	import { page } from '$app/state';
	import { IconFolder } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import AddressForm from './components/AddressForm.svelte';
	import AddressLocationCard from './components/AddressLocationCard.svelte';
	import MicroductConnectionsCard from './components/MicroductConnectionsCard.svelte';
	import ResidentialUnitsSection from './components/ResidentialUnitsSection.svelte';

	const projectId = $derived(page.params.projectId ?? '');
	const uuid = $derived(page.params.uuid ?? '');

	let fileExplorer = $state<ReturnType<typeof FileExplorer> | null>(null);

	function handleUploadComplete() {
		fileExplorer?.refresh();
	}
</script>

<svelte:head>
	<title>{m.nav_address()}</title>
</svelte:head>

<div class="max-w-6xl mx-auto space-y-4 sm:space-y-6">
	{#key uuid}
		<div class="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
			<QueryBoundary class="lg:col-span-5">
				<AddressForm {uuid} {projectId} />
			</QueryBoundary>

			<QueryBoundary class="lg:col-span-2">
				<AddressLocationCard {uuid} {projectId} />
			</QueryBoundary>
		</div>

		<QueryBoundary>
			<MicroductConnectionsCard {uuid} />
		</QueryBoundary>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
			<div class="card p-4 sm:p-6 space-y-4">
				<div class="flex items-center gap-3">
					<IconFolder class="size-5 text-success-500" />
					<h2 class="text-lg font-semibold">{m.form_attachments()}</h2>
				</div>

				<FileUpload
					featureType="address"
					featureId={uuid}
					onUploadComplete={handleUploadComplete}
				/>
				<FileExplorer bind:this={fileExplorer} featureType="address" featureId={uuid} />
			</div>

			<QueryBoundary>
				<ResidentialUnitsSection addressUuid={uuid} {projectId} />
			</QueryBoundary>
		</div>
	{/key}
</div>
